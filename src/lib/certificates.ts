import { randomInt } from 'node:crypto'
import { GetCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { certificate } from '@/content/certificate'
import { event } from '@/content/event'
import { ddb, tableName } from './db/client'
import { PASS_ALPHABET } from './db/keys'
import { failedIndexes, transactWithRetry } from './db/tx'
import { sendEmail } from './email/send'
import { siteUrl } from './site'

/**
 * Certificates of participation. One per pass, stored as ATT#<passId> / CERT
 * and found by its public id through GSI1 (CERT#<certId>). The survey
 * submission ID it was earned with is claimed under SURVEY#<id> in the same
 * transaction, so one survey answer earns one certificate.
 *
 * Issued on the spot when the checks pass: a verified pass, a submission ID
 * in the survey's own format and not used by anyone else, and a screenshot in
 * the bucket. A submission ID another pass already holds is not refused: the
 * certificate is HELD for an admin to look at the two screenshots, so a typo
 * on someone else's side never blocks a real attendee.
 */

export type CertState = 'ISSUED' | 'HELD' | 'REVOKED'

export type Cert = {
  PK: string
  SK: 'CERT'
  GSI1PK: string
  GSI1SK: 'CERT'
  certId: string
  passId: string
  certName: string
  /** The registered email, where the certificate link goes. */
  email: string
  surveyId: string
  screenshotKey: string
  state: CertState
  createdAt: string
  issuedAt?: string
  /** Why an admin held or revoked it, or the automatic reason. */
  note?: string
}

const certKey = (passId: string) => ({ PK: `ATT#${passId}`, SK: 'CERT' as const })
const surveyKey = (surveyId: string) => ({ PK: `SURVEY#${surveyId}`, SK: 'CLAIM' })

/** C- and 10 letters from the pass alphabet: printed on the certificate, read aloud without confusion. */
function newCertId(): string {
  let out = ''
  for (let i = 0; i < 10; i++) out += PASS_ALPHABET[randomInt(PASS_ALPHABET.length)]
  return `C-${out}`
}

export const certUrl = (certId: string) => `${siteUrl()}/certificate/${certId}`

export async function getCertByPass(passId: string): Promise<Cert | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: certKey(passId) }))
  return (res.Item as Cert | undefined) ?? null
}

export async function getCert(certId: string): Promise<Cert | null> {
  if (!/^C-[A-Z0-9]{10}$/.test(certId)) return null
  const res = await ddb.send(
    new QueryCommand({ TableName: tableName(), IndexName: 'GSI1', KeyConditionExpression: 'GSI1PK = :pk', ExpressionAttributeValues: { ':pk': `CERT#${certId}` }, Limit: 1 }),
  )
  return (res.Items?.[0] as Cert | undefined) ?? null
}

export type ClaimInput = { passId: string; name: string; email: string; certName: string; surveyId: string; screenshotKey: string }
export type ClaimResult = { cert: Cert; fresh: boolean } | { error: string }

/**
 * Earn the certificate. A pass that already has one gets it back, with the
 * printed name updated when the same survey ID is given again; a different
 * survey ID on a pass that already has a certificate is refused.
 */
export async function claimCertificate(c: ClaimInput): Promise<ClaimResult> {
  const at = new Date().toISOString()
  const before = await getCertByPass(c.passId)
  if (before) {
    if (before.surveyId !== c.surveyId) return { error: 'This pass already has a certificate, earned with a different survey submission ID. Use that ID to update it, or write to us.' }
    if (before.state === 'REVOKED') return { error: 'The certificate for this pass was withdrawn. Write to us if you think that is a mistake.' }
    const res = await ddb.send(
      new UpdateCommand({ TableName: tableName(), Key: certKey(c.passId), UpdateExpression: 'SET certName = :n', ExpressionAttributeValues: { ':n': c.certName }, ReturnValues: 'ALL_NEW' }),
    )
    return { cert: res.Attributes as Cert, fresh: false }
  }

  const certId = newCertId()
  const base: Cert = {
    ...certKey(c.passId),
    GSI1PK: `CERT#${certId}`,
    GSI1SK: 'CERT',
    certId,
    passId: c.passId,
    certName: c.certName,
    email: c.email,
    surveyId: c.surveyId,
    screenshotKey: c.screenshotKey,
    state: 'ISSUED',
    createdAt: at,
    issuedAt: at,
  }
  const putCert = (item: Cert) => ({ Put: { TableName: tableName(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } })
  try {
    await transactWithRetry([
      putCert(base),
      { Put: { TableName: tableName(), Item: { ...surveyKey(c.surveyId), surveyId: c.surveyId, passId: c.passId, at }, ConditionExpression: 'attribute_not_exists(PK)' } },
    ])
  } catch (err) {
    const failed = failedIndexes(err)
    if (failed.includes(0)) {
      // Two tabs at once: the other one won. Hand back what it made.
      const won = await getCertByPass(c.passId)
      if (won) return { cert: won, fresh: false }
    }
    if (!failed.includes(1)) throw err
    const held: Cert = { ...base, state: 'HELD', note: 'Survey submission ID already used by another pass' }
    delete held.issuedAt
    await transactWithRetry([putCert(held)])
    return { cert: held, fresh: true }
  }
  return { cert: base, fresh: true }
}

/** Every certificate, newest first. Admin only: a scan, fine at a few hundred. */
export async function listCerts(): Promise<Cert[]> {
  const out: Cert[] = []
  let start: Record<string, unknown> | undefined
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: tableName(), FilterExpression: 'SK = :sk AND begins_with(PK, :pk)', ExpressionAttributeValues: { ':sk': 'CERT', ':pk': 'ATT#' }, ExclusiveStartKey: start }),
    )
    out.push(...((res.Items ?? []) as Cert[]))
    start = res.LastEvaluatedKey
  } while (start)
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Admin: issue a held certificate, or withdraw one. Returns the updated record, or null if it was not in a state to change. */
export async function setCertState(passId: string, to: 'ISSUED' | 'REVOKED', by: string): Promise<Cert | null> {
  const from = to === 'ISSUED' ? ['HELD', 'REVOKED'] : ['ISSUED', 'HELD']
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: certKey(passId),
        UpdateExpression: to === 'ISSUED' ? 'SET #s = :to, issuedAt = :at, note = :note' : 'SET #s = :to, note = :note',
        ConditionExpression: '#s IN (:a, :b)',
        ExpressionAttributeNames: { '#s': 'state' },
        ExpressionAttributeValues: { ':to': to, ':a': from[0], ':b': from[1], ':note': `${to === 'ISSUED' ? 'Issued' : 'Withdrawn'} by ${by}`, ...(to === 'ISSUED' ? { ':at': new Date().toISOString() } : {}) },
        ReturnValues: 'ALL_NEW',
      }),
    )
    return res.Attributes as Cert
  } catch {
    return null
  }
}

/** The mail with the certificate link. Sent once, when it is issued. */
export async function mailCertificate(c: Cert): Promise<void> {
  const url = certUrl(c.certId)
  const first = c.certName.trim().split(/\s+/)[0] ?? c.certName
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  await sendEmail({
    to: c.email,
    subject: `Your certificate: ${event.shortName}`,
    text: `Hi ${first},\n\nYour ${certificate.title} for ${event.name} is ready.\n\nView, download and add it to LinkedIn here:\n${url}\n\nCertificate ID: ${c.certId}\n\n${certificate.issuer}`,
    html: `<div style="font:15px/1.6 Arial,Helvetica,sans-serif;color:#14161C;max-width:560px">
<p>Hi ${esc(first)},</p>
<p>Your <strong>${esc(certificate.title)}</strong> for ${esc(event.name)} is ready.</p>
<p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#FF9900;border:3px solid #14161C;color:#14161C;font:bold 15px 'Courier New',monospace;text-decoration:none">VIEW YOUR CERTIFICATE &gt;</a></p>
<p>Download it, add it to your LinkedIn profile, or share it from that page.</p>
<p style="color:#5A6070;font-size:13px">Certificate ID ${esc(c.certId)} &middot; ${esc(certificate.issuer)}</p>
</div>`,
  })
}

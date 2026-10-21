import { REFERRAL_CUTOFF_LABEL, referralOpen } from '@/content/referral'
import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'
import { candidates, isBlocked, isUsableCode, normaliseCode } from '@/lib/referral/codes'
import { listAttendees } from '@/lib/db/queries'
import { addReferrer, board, claimCode, codeOwner, displayName, findMine, unclaimed } from '@/lib/referral/store'

/**
 * The referral actions, one route:
 *   check   {code}                    is this a code someone holds? (the registration form asks as you type)
 *   me      {passId, email}           my code, my count, who referred me
 *   suggest {passId, email, want}     four or five free codes built on a word
 *   claim   {passId, email, code}     take one of them
 *   add     {passId, email, code}     "someone referred me": for people who registered without a code
 * The pass ID and email pair is the proof of who you are: both are in your own registration email.
 */
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

const NOT_FOUND = 'Referral code not found. Check the spelling with the person who gave it to you.'
const NOT_YOU = 'We could not find a registration with that pass ID and email. Both are in your registration email.'

/** Their count and place on the board, read fresh. */
async function standing(code?: string): Promise<{ count: number; rank: number | null }> {
  if (!code) return { count: 0, rank: null }
  const row = board(await listAttendees()).find((r) => r.code === code)
  return { count: row?.count ?? 0, rank: row?.rank ?? null }
}

type Body = { action?: unknown; code?: unknown; passId?: unknown; email?: unknown; want?: unknown }
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function POST(req: Request): Promise<Response> {
  // Campus wifi puts hundreds behind one address, so this is generous; it only stops a script walking the codes.
  if (!(await withinRateLimit(callerIp(req), 'REFER', 600))) return json(429, { ok: false, message: 'Too many tries from this network. Wait a little and try again.' })
  const b = ((await req.json().catch(() => null)) ?? {}) as Body
  const action = str(b.action)

  if (action === 'check') {
    const code = normaliseCode(str(b.code))
    const owner = code ? await codeOwner(code) : null
    if (!owner) return json(404, { ok: false, field: 'code', message: NOT_FOUND })
    return json(200, { ok: true, code, name: displayName(owner) })
  }

  const me = await findMine(str(b.passId), str(b.email))
  if (!me) return json(404, { ok: false, field: 'pass', message: NOT_YOU })

  if (action === 'me') {
    const referrer = me.referredBy ? await codeOwner(me.referredBy) : null
    return json(200, {
      ok: true,
      name: me.firstName,
      code: me.refCode ?? null,
      ...(await standing(me.refCode)),
      last: me.lastName,
      referredBy: me.referredBy ? { code: me.referredBy, name: referrer ? displayName(referrer) : null } : null,
      open: referralOpen(),
    })
  }

  if (action === 'suggest') {
    if (me.refCode) return json(409, { ok: false, message: `You already have a code: ${me.refCode}.` })
    const want = str(b.want)
    if (want && isBlocked(want.replace(/[^A-Za-z0-9]/g, ''))) return json(400, { ok: false, field: 'want', message: 'That word is not allowed. Try another one, like your name or nickname.' })
    const free = await unclaimed(candidates(want || me.firstName, me.firstName, me.lastName))
    if (!free.length) return json(404, { ok: false, field: 'want', message: 'Those are all taken. Try a different word.' })
    return json(200, { ok: true, suggestions: free.slice(0, 5) })
  }

  if (action === 'claim') {
    const code = normaliseCode(str(b.code))
    if (!code || !isUsableCode(code)) return json(400, { ok: false, field: 'code', message: 'Pick one of the suggested codes.' })
    const out = await claimCode(me, code)
    if (!out.ok) return json(409, { ok: false, field: 'code', message: out.reason === 'taken' ? 'Someone just took that one. Pick another.' : 'You already have a code.' })
    console.info(`[referral] ${me.passId} claimed ${code}`)
    return json(200, { ok: true, code })
  }

  if (action === 'add') {
    if (!referralOpen()) return json(403, { ok: false, message: `Referrals closed on ${REFERRAL_CUTOFF_LABEL}.` })
    if (me.referredBy) return json(409, { ok: false, message: `Your registration already has a referral code: ${me.referredBy}.` })
    const code = normaliseCode(str(b.code))
    const owner = code ? await codeOwner(code) : null
    if (!code || !owner) return json(404, { ok: false, field: 'code', message: NOT_FOUND })
    if (owner.passId === me.passId || owner.email === me.email) return json(400, { ok: false, field: 'code', message: 'That is your own code. Use the code of the person who told you about the event.' })
    if (!(await addReferrer(me, code))) return json(409, { ok: false, message: 'Your registration already has a referral code.' })
    console.info(`[referral] ${me.passId} referred by ${code}`)
    return json(200, { ok: true, code, name: displayName(owner) })
  }

  return json(400, { ok: false, message: 'Unknown action.' })
}

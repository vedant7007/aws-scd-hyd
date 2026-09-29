import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from './db/client'
import { keys } from './db/keys'
import { listSubscribers } from './db/queries'
import { isReservedAddress, sendEmail } from './email/send'
import { registrationsOpen } from './email/templates'
import { registrationIsOpen } from './tickets/launch'

/**
 * The "registrations are open" mail to everyone on the notify list. Each
 * address is marked right after its send, conditional on no mark, so an
 * interrupted run resumes where it stopped and pressing the button twice
 * mails nobody twice. Refuses while registration is not actually open: the
 * link would land on the locked page.
 */
export async function mailNotifyListOpen(): Promise<
  { ok: true; sent: number; already: number; skipped: number; failed: number } | { ok: false; message: string }
> {
  if (!(await registrationIsOpen())) return { ok: false, message: 'Registration is not open, so the link would land on the locked page. Nothing was sent.' }
  const mail = registrationsOpen()
  let sent = 0
  let already = 0
  let skipped = 0
  let failed = 0
  for (const s of await listSubscribers()) {
    if (s.openMailSentAt) {
      already++
      continue
    }
    if (isReservedAddress(s.email)) {
      skipped++
      continue
    }
    try {
      await sendEmail({ to: s.email, ...mail })
      await ddb.send(
        new UpdateCommand({
          TableName: tableName(),
          Key: keys.subscriber(s.email),
          UpdateExpression: 'SET openMailSentAt = :now',
          ConditionExpression: 'attribute_not_exists(openMailSentAt)',
          ExpressionAttributeValues: { ':now': new Date().toISOString() },
        }),
      )
      sent++
    } catch (err) {
      failed++
      console.error(`[notify-open] ${s.email} failed, not marked`, err)
    }
  }
  console.info(`[notify-open] sent ${sent}, already ${already}, skipped ${skipped}, failed ${failed}`)
  return { ok: true, sent, already, skipped, failed }
}

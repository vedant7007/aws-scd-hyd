/**
 * The referral launch mail, once, to everyone already registered (payment
 * submitted or verified): their code, who referred them, the Builder ID if
 * missing, the "I'm attending" post.
 *
 *   AWS_PROFILE=scd SCD_TABLE_NAME=<table> npx tsx scripts/send-referral-launch.ts          # dry run: who would get it
 *   AWS_PROFILE=scd SCD_TABLE_NAME=<table> npx tsx scripts/send-referral-launch.ts --go     # send
 *
 * Run it from a folder with no amplify_outputs.json (that file points at the
 * sandbox and wins over SCD_TABLE_NAME). Each send is marked with
 * referralMailAt, so a second run skips whoever already has it.
 */
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../src/lib/db/client'
import { keys } from '../src/lib/db/keys'
import { listAttendees } from '../src/lib/db/queries'
import { isReservedAddress, sendEmail } from '../src/lib/email/send'
import { referralLaunch } from '../src/lib/email/templates'
import { isLive } from '../src/lib/referral/store'

const go = process.argv.includes('--go')

async function main() {
  const table = tableName()
  const all = await listAttendees()
  const due = all.filter((a) => isLive(a) && !isReservedAddress(a.email) && !(a as { referralMailAt?: string }).referralMailAt)
  console.log(`${table}\n${due.length} to mail (${due.filter((a) => !a.builderId).length} of them also missing a Builder ID)`)
  if (!go) return console.log('dry run, nothing sent. Add --go to send.')

  let sent = 0
  for (const a of due) {
    try {
      await sendEmail({ to: a.email, ...referralLaunch(a) })
      await ddb.send(new UpdateCommand({ TableName: table, Key: keys.attendee(a.passId), UpdateExpression: 'SET referralMailAt = :t', ExpressionAttributeValues: { ':t': new Date().toISOString() } }))
      sent++
    } catch (err) {
      console.error(`failed ${a.passId}`, err)
    }
    // SES sandbox-safe pace: well under the per-second limit.
    await new Promise((r) => setTimeout(r, 120))
  }
  console.log(`sent ${sent} of ${due.length}`)
}

main()

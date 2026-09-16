import { PutSuppressedDestinationCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, tableName } from '../../../src/lib/db/client'
import { gsi1, keys, normaliseEmail } from '../../../src/lib/db/keys'
import type { EmailEvent, EmailEventType } from '../../../src/lib/db/types'

/**
 * Bounce and complaint handling, SPEC.md section 12 and the commitment made to
 * AWS Support when production access was requested.
 *
 * SES publishes an event to SNS for every bounce and complaint on mail sent
 * through our configuration set. SNS invokes this function once per event.
 *
 * Each recipient is recorded under its address so the history is queryable,
 * and listed by type on GSI1 so the dashboard can count them without a scan.
 *
 * Suppression: every complaint and every permanent bounce puts the address on
 * the account level SES suppression list, after which SES refuses to send to
 * it at all, from any code path. A transient bounce, a full mailbox for
 * example, is recorded but not suppressed, because the address is still good.
 */

/** The shape SNS hands to Lambda. Typed by hand, it is three fields. */
type SnsEvent = {
  Records: { Sns: { MessageId: string; Message: string } }[]
}

/** The SES event publishing format. Only the fields used here. */
type SesEvent = {
  eventType?: string
  notificationType?: string
  mail?: { messageId?: string; timestamp?: string }
  bounce?: {
    bounceType?: string
    bounceSubType?: string
    feedbackId?: string
    timestamp?: string
    bouncedRecipients?: { emailAddress?: string }[]
  }
  complaint?: {
    complaintFeedbackType?: string
    feedbackId?: string
    timestamp?: string
    complainedRecipients?: { emailAddress?: string }[]
  }
}

const REGION = process.env.AWS_REGION ?? 'ap-south-1'
const ses = new SESv2Client({ region: REGION })

/**
 * The mailbox simulator produces real bounce and complaint events but SES
 * refuses to put its addresses on the suppression list, returning
 * "Email address ... is invalid". Skipping them keeps a test from logging an
 * error every time and keeps the dashboard's alarm for genuine failures.
 */
const isSimulator = (address: string) => address.endsWith('@simulator.amazonses.com')

async function suppress(address: string, reason: 'BOUNCE' | 'COMPLAINT'): Promise<boolean> {
  try {
    await ses.send(new PutSuppressedDestinationCommand({ EmailAddress: address, Reason: reason }))
    return true
  } catch (err) {
    // Recording still happens. A suppression that failed is visible on the
    // dashboard as suppressed: false and can be redone by hand.
    console.error('[email-events] suppression failed', { address, reason, err })
    return false
  }
}

async function record(event: Omit<EmailEvent, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        ...keys.emailEvent(event.address, event.occurredAt, event.type),
        ...gsi1.emailEventByType(event.type, event.occurredAt),
        ...event,
      } satisfies EmailEvent,
    }),
  )
}

export const handler = async (input: SnsEvent): Promise<{ recorded: number; suppressed: number }> => {
  let recorded = 0
  let suppressedCount = 0
  const recordedAt = new Date().toISOString()

  for (const rec of input.Records ?? []) {
    let msg: SesEvent
    try {
      msg = JSON.parse(rec.Sns.Message) as SesEvent
    } catch {
      console.error('[email-events] unparseable SNS message', rec.Sns.MessageId)
      continue
    }

    // Configuration set event publishing uses eventType. Identity level
    // notifications use notificationType. Accept either, same shape otherwise.
    const kind = (msg.eventType ?? msg.notificationType ?? '').toLowerCase()
    if (kind !== 'bounce' && kind !== 'complaint') {
      console.info(`[email-events] ignoring ${kind || 'unknown'} event`)
      continue
    }
    const type: EmailEventType = kind

    const detail = type === 'bounce' ? msg.bounce : msg.complaint
    const recipients =
      type === 'bounce' ? (msg.bounce?.bouncedRecipients ?? []) : (msg.complaint?.complainedRecipients ?? [])
    const subType =
      type === 'bounce' ? (msg.bounce?.bounceType ?? 'Unknown') : (msg.complaint?.complaintFeedbackType ?? 'unknown')
    const occurredAt = detail?.timestamp ?? msg.mail?.timestamp ?? recordedAt

    // Only a permanent bounce means the address is dead. A complaint always
    // means the person does not want mail from us, whatever the reason.
    const shouldSuppress = type === 'complaint' || subType === 'Permanent'

    for (const r of recipients) {
      const address = normaliseEmail(r.emailAddress ?? '')
      if (!address) continue

      let suppressed = false
      let note: string | undefined
      if (!shouldSuppress) {
        note = 'transient, address still deliverable'
      } else if (isSimulator(address)) {
        note = 'simulator address, SES does not allow suppression'
      } else {
        suppressed = await suppress(address, type === 'bounce' ? 'BOUNCE' : 'COMPLAINT')
        if (suppressed) suppressedCount++
      }

      await record({
        type,
        subType,
        address,
        messageId: msg.mail?.messageId ?? '',
        feedbackId: detail?.feedbackId ?? '',
        occurredAt,
        recordedAt,
        suppressed,
        ...(note ? { note } : {}),
      })
      recorded++

      console.info(`[email-events] ${type} ${subType} ${address} suppressed=${suppressed}`)
    }
  }

  return { recorded, suppressed: suppressedCount }
}

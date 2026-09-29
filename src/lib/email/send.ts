import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { outputs } from '../outputs'

/**
 * SPEC.md section 12. One way out for every email the site sends.
 *
 * Plain text and simple HTML, no images, no tracking. The domain is send only,
 * so Reply-To is set on the envelope here, not left to a template to remember.
 *
 * Transport is console in development and SES in production, overridable with
 * EMAIL_TRANSPORT so a local run can be pointed at real SES on purpose.
 */

export type Mail = {
  to: string
  subject: string
  text: string
  html: string
  /** Defaults to SES_REPLY_TO. Organiser notifications set it to the sender so a reply reaches them. */
  replyTo?: string
}

export type SendResult = {
  transport: 'ses' | 'console'
  messageId: string
}

type Transport = SendResult['transport']

const REGION = process.env.AWS_REGION ?? 'ap-south-1'

/** Reserved by RFC 2606. Nothing at these domains can be a real person. */
const NEVER_SEND = /@(?:example\.(?:test|com|net|org)|test|invalid|localhost)$/i

/** True for seeded and mock attendees, so a retry loop can skip them quietly. */
export const isReservedAddress = (address: string) => NEVER_SEND.test(address.trim())

function transport(): Transport {
  const forced = process.env.EMAIL_TRANSPORT
  if (forced === 'ses' || forced === 'console') return forced
  return process.env.NODE_ENV === 'production' ? 'ses' : 'console'
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set and email cannot be sent without it.`)
  return value
}

/**
 * The SES configuration set that publishes bounces and complaints to SNS.
 * Resolved from amplify_outputs.json locally and from the environment in Lambda
 * and Hosting. Sending without it still works, but nothing would be recorded,
 * so it is required rather than optional.
 */
function configurationSet(): string {
  const fromOutputs = outputs()?.custom?.sesConfigurationSet
  return fromOutputs ?? required('SES_CONFIGURATION_SET')
}

let client: SESv2Client | null = null
const ses = () => (client ??= new SESv2Client({ region: REGION }))

export async function sendEmail(mail: Mail): Promise<SendResult> {
  const to = mail.to.trim().toLowerCase()

  // Seeded attendees carry example.test addresses. Refusing here means no code
  // path, including a future bulk reminder, can ever mail a fake person.
  if (NEVER_SEND.test(to)) {
    throw new Error(`Refusing to send to a reserved test address: ${to}`)
  }

  if (transport() === 'console') {
    console.info(`[email:console] to=${to} subject=${JSON.stringify(mail.subject)}\n${mail.text}`)
    return { transport: 'console', messageId: `console-${Date.now()}` }
  }

  // SES allows 14 sends a second on this account. Fifty students submitting
  // at once would otherwise get some receipts refused, so a throttled send
  // waits a random moment and tries again, up to six times.
  const send = () =>
    ses().send(
      new SendEmailCommand({
        FromEmailAddress: required('SES_FROM'),
        ReplyToAddresses: [mail.replyTo ?? required('SES_REPLY_TO')],
        Destination: { ToAddresses: [to] },
        ConfigurationSetName: configurationSet(),
        Content: {
          Simple: {
            Subject: { Data: mail.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: mail.text, Charset: 'UTF-8' },
              Html: { Data: mail.html, Charset: 'UTF-8' },
            },
          },
        },
      }),
    )
  let res
  for (let attempt = 0; ; attempt++) {
    try {
      res = await send()
      break
    } catch (err) {
      const name = (err as { name?: string }).name ?? ''
      const throttled = /Throttl|TooManyRequests|LimitExceeded/i.test(name)
      if (!throttled || attempt >= 5) throw err
      await new Promise((r) => setTimeout(r, 200 * 2 ** attempt + Math.random() * 400))
    }
  }

  return { transport: 'ses', messageId: res.MessageId ?? '' }
}

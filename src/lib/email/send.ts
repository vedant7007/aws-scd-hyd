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
}

export type SendResult = {
  transport: 'ses' | 'console'
  messageId: string
}

type Transport = SendResult['transport']

const REGION = process.env.AWS_REGION ?? 'ap-south-1'

/** Reserved by RFC 2606. Nothing at these domains can be a real person. */
const NEVER_SEND = /@(?:example\.(?:test|com|net|org)|test|invalid|localhost)$/i

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

  const res = await ses().send(
    new SendEmailCommand({
      FromEmailAddress: required('SES_FROM'),
      ReplyToAddresses: [required('SES_REPLY_TO')],
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

  return { transport: 'ses', messageId: res.MessageId ?? '' }
}

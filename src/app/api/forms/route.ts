import { callerIp, withinRateLimit } from '@/lib/db/rate-limit'
import { FORM_KINDS, submitForm, validateForm, type FormKind } from '@/lib/forms'

/**
 * Apply to speak, sponsor enquiry and the code of conduct report, one route.
 * `form` picks which; the rest is checked by validateForm. `company` is a
 * honeypot, answered like a success and stored nowhere.
 */
const PER_IP_PER_HOUR = 20

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || !FORM_KINDS.includes(body.form as FormKind)) return json(400, { ok: false, message: 'Send a form.' })
  const kind = body.form as FormKind

  if (typeof body.company === 'string' && body.company.trim()) return json(200, { ok: true, ref: 'SCD-RCV-00000' })

  const v = validateForm(kind, body)
  if ('error' in v) return json(400, { ok: false, ...v.error })

  if (!(await withinRateLimit(callerIp(req), 'FORM', PER_IP_PER_HOUR))) {
    return json(429, { ok: false, message: 'That is a lot from one connection. Try again in an hour, or write to us directly.' })
  }

  const saved = await submitForm(kind, v)
  console.info(`[forms] ${saved.ref} stored`)
  return json(200, { ok: true, ref: saved.ref })
}

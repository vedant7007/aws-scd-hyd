import { REGISTRATION_OPEN, registrationOpen as contentDefault } from '../../content/event'
import { passes } from '../../content/passes'
import { payment } from '../../content/payment'
import { adminCount } from '../auth/crew'
import { getConfig } from '../db/queries'
import { VERIFICATION_WINDOW } from '../email/templates'
import { screenshotsConfigured } from '../registration/screenshots'

/**
 * The guard between a half-configured site and real students.
 *
 * The registration switch lives on the config item and is flipped by an
 * admin. On its own it is one click away from taking registrations nobody
 * can pay or verify, so it is not allowed to be the only thing that opens
 * the till. Selling is refused while any blocker holds. The blockers are
 * computed everywhere and shown on the dashboard everywhere. They are
 * enforced in production, which is what next start and Amplify run;
 * development is exempt so the flow can be exercised at all. NODE_ENV is
 * set by the runtime, not by configuration, so nothing in an env file can
 * lift the guard on a deployed server.
 *
 * Every tier priced, the college UPI id set (the QR is built from it), a
 * screenshot bucket to upload to, the verification wording set, at least
 * one admin to verify. Session seat counts are optional: an unsized
 * session has no limit (lib/db/tx.ts).
 */

export type LaunchBlocker = {
  code: 'unpriced-tier' | 'upi-id-unset' | 'screenshots-unset' | 'verification-window-unset' | 'no-admin'
  /** A sentence for the dashboard. Never includes a key or any secret. */
  detail: string
}

export type LaunchInput = {
  tiers: { id: string; pricePaise: number | null }[]
  upiId: string | null
  screenshots: boolean
  verificationWindow: string
  /** Admins able to verify: the table's count, or the fallback list while that is zero. */
  adminEmails: string[]
}

/** Pure, so each condition can be checked on its own. */
export function launchBlockers(input: LaunchInput): LaunchBlocker[] {
  const out: LaunchBlocker[] = []

  const unpriced = input.tiers.filter((t) => t.pricePaise === null).map((t) => t.id)
  if (unpriced.length) {
    out.push({ code: 'unpriced-tier', detail: `${unpriced.length === 1 ? 'A tier has' : 'Tiers have'} no price in content/passes.ts: ${unpriced.join(', ')}.` })
  }
  if (!input.upiId) {
    out.push({ code: 'upi-id-unset', detail: 'The college UPI id is not set in content/payment.ts, so the payment QR cannot be made. Nobody can pay without it.' })
  }
  if (!input.screenshots) {
    out.push({ code: 'screenshots-unset', detail: 'No screenshot bucket is configured, so nobody can upload a payment screenshot.' })
  }
  if (!input.verificationWindow.trim()) {
    out.push({ code: 'verification-window-unset', detail: 'VERIFICATION_WINDOW in lib/email/templates.ts is empty, so email 1 cannot say when to expect an answer.' })
  }
  if (input.adminEmails.length === 0) {
    out.push({ code: 'no-admin', detail: 'No admin in the table and ADMIN_EMAILS is empty, so nobody can verify a payment.' })
  }
  return out
}

export const fromEnvironment = async (): Promise<LaunchInput> => {
  const admins = await adminCount()
  const fallback = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return {
    tiers: passes.map((p) => ({ id: p.id, pricePaise: p.pricePaise })),
    upiId: payment.upiId,
    screenshots: screenshotsConfigured(),
    verificationWindow: VERIFICATION_WINDOW,
    adminEmails: admins > 0 ? Array.from({ length: admins }, (_, i) => `table admin ${i + 1}`) : fallback,
  }
}

export type LaunchStatus = {
  /** The switch, as the config item holds it (the content default until it is ever written), under REGISTRATION_OPEN. */
  registrationOpen: boolean
  blockers: LaunchBlocker[]
  /** Whether blockers are refusing registrations here. False only in development. */
  enforced: boolean
  /** registrationOpen, and nothing enforced is blocking. What the site acts on. */
  open: boolean
}

export async function launchStatus(): Promise<LaunchStatus> {
  const [input, config] = await Promise.all([fromEnvironment(), getConfig()])
  const blockers = launchBlockers(input)
  const enforced = process.env.NODE_ENV === 'production'
  // The switch is read from the table on every call, never cached: closing
  // registration has to take effect on the very next request. Two gates, and
  // the code flag wins: an admin re-opening the settings switch cannot sell
  // anything while REGISTRATION_OPEN is false.
  const switched = REGISTRATION_OPEN && (config?.registrationOpen ?? contentDefault)
  // The acceptance suite needs holds open against the sandbox. Only ever
  // honoured outside production, where NODE_ENV is set by the runtime.
  const open = switched || (!enforced && process.env.SCD_DEV_REGISTRATION_OPEN === '1')
  return { registrationOpen: open, blockers, enforced, open: open && !(enforced && blockers.length > 0) }
}

/** The one question every entry point asks. Never read the flag directly for this. */
export const registrationIsOpen = async () => (await launchStatus()).open

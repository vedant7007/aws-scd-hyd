import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registrationOpen } from '../../content/event'
import { passes } from '../../content/passes'
import { payment } from '../../content/payment'
import { sessionSpecs } from '../../content/sessions'
import { tracks } from '../../content/tracks'
import type { PaymentMode } from '../db/types'
import { VERIFICATION_WINDOW } from '../email/templates'
import { paymentMode } from './mode'

/**
 * The guard between a half-configured site and real students.
 *
 * registrationOpen is a content flag. On its own it is one edit away from
 * taking registrations nobody can seat or verify, so it is not allowed to be
 * the only thing that opens the till. Selling is refused while any blocker
 * for the current payment mode holds. The blockers are computed everywhere
 * and shown on the dashboard everywhere. They are enforced in production,
 * which is what next start and Amplify run; development is exempt so the
 * flow can be exercised at all. NODE_ENV is set by the runtime, not by
 * configuration, so nothing in an env file can lift the guard on a deployed
 * server.
 *
 * Manual mode: every tier priced, the college QR asset present, the
 * verification wording set, at least one admin to verify, and a room and a
 * sellable capacity for every session so a registration can actually be
 * counted against a track and later seated.
 *
 * Razorpay mode: the live key, every tier priced, no test amount in the
 * environment, plus the same room and capacity conditions.
 */

export type LaunchBlocker = {
  code:
    | 'test-key'
    | 'unpriced-tier'
    | 'test-amount-set'
    | 'qr-asset-missing'
    | 'verification-window-unset'
    | 'no-admin'
    | 'rooms-unassigned'
    | 'capacity-unset'
  /** A sentence for the dashboard. Never includes a key or any secret. */
  detail: string
}

export type LaunchInput = {
  mode: PaymentMode
  keyId: string | undefined
  tiers: { id: string; pricePaise: number | null }[]
  testAmount: string | undefined
  qrAssetPresent: boolean
  verificationWindow: string
  adminEmails: string[]
  /** Tracks with no room, and sessions with no sellable capacity. */
  unassignedTracks: string[]
  unsetSessions: string[]
}

/** Pure, so each condition can be checked on its own. */
export function launchBlockers(input: LaunchInput): LaunchBlocker[] {
  const out: LaunchBlocker[] = []

  const unpriced = input.tiers.filter((t) => t.pricePaise === null).map((t) => t.id)
  if (unpriced.length) {
    out.push({
      code: 'unpriced-tier',
      detail: `${unpriced.length === 1 ? 'A tier has' : 'Tiers have'} no price in content/passes.ts: ${unpriced.join(', ')}. The one rupee placeholder would apply.`,
    })
  }

  if (input.mode === 'razorpay') {
    if (!input.keyId) {
      out.push({ code: 'test-key', detail: 'RAZORPAY_KEY_ID is not set, so no order can be created.' })
    } else if (!input.keyId.startsWith('rzp_live_')) {
      out.push({ code: 'test-key', detail: `RAZORPAY_KEY_ID is a ${input.keyId.startsWith('rzp_test_') ? 'test' : 'non-live'} key. Live keys start with rzp_live_.` })
    }
    if (input.testAmount !== undefined) {
      out.push({ code: 'test-amount-set', detail: `RAZORPAY_TEST_AMOUNT_PAISE is set (${input.testAmount || 'empty'}). It must be absent, not merely unused.` })
    }
  } else {
    if (!input.qrAssetPresent) {
      out.push({ code: 'qr-asset-missing', detail: `The college UPI QR is not at public${payment.qrAssetPath}. Nobody can pay without it.` })
    }
    if (!input.verificationWindow.trim()) {
      out.push({ code: 'verification-window-unset', detail: 'VERIFICATION_WINDOW in lib/email/templates.ts is empty, so email 1 cannot say when to expect an answer.' })
    }
    if (input.adminEmails.length === 0) {
      out.push({ code: 'no-admin', detail: 'ADMIN_EMAILS is empty, so nobody can verify a payment.' })
    }
  }

  if (input.unassignedTracks.length) {
    out.push({ code: 'rooms-unassigned', detail: `No room assigned in content/event.ts for: ${input.unassignedTracks.join(', ')}. Their track counters have no ceiling.` })
  }
  if (input.unsetSessions.length) {
    out.push({ code: 'capacity-unset', detail: `No sellableCapacity in content/event.ts for ${input.unsetSessions.length} session(s): ${input.unsetSessions.slice(0, 4).join(', ')}${input.unsetSessions.length > 4 ? ', ...' : ''}.` })
  }

  return out
}

export const fromEnvironment = (): LaunchInput => {
  const specs = sessionSpecs()
  return {
    mode: paymentMode(),
    keyId: process.env.RAZORPAY_KEY_ID,
    tiers: passes.map((p) => ({ id: p.id, pricePaise: p.pricePaise })),
    testAmount: process.env.RAZORPAY_TEST_AMOUNT_PAISE,
    qrAssetPresent: existsSync(join(process.cwd(), 'public', payment.qrAssetPath)),
    verificationWindow: VERIFICATION_WINDOW,
    adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    unassignedTracks: tracks.filter((t) => !specs.some((s) => s.track === t.id && s.roomId)).map((t) => t.id),
    unsetSessions: specs.filter((s) => s.sellableCapacity === null).map((s) => s.sessionId),
  }
}

export type LaunchStatus = {
  mode: PaymentMode
  /** The content flag, as written. */
  registrationOpen: boolean
  blockers: LaunchBlocker[]
  /** Whether blockers are refusing registrations here. False only in development. */
  enforced: boolean
  /** registrationOpen, and nothing enforced is blocking. What the site acts on. */
  open: boolean
}

export function launchStatus(): LaunchStatus {
  const input = fromEnvironment()
  const blockers = launchBlockers(input)
  const enforced = process.env.NODE_ENV === 'production'
  // The acceptance suite needs step one open against the sandbox. Only ever
  // honoured outside production, where NODE_ENV is set by the runtime.
  const open = registrationOpen || (!enforced && process.env.SCD_DEV_REGISTRATION_OPEN === '1')
  return {
    mode: input.mode,
    registrationOpen: open,
    blockers,
    enforced,
    open: open && !(enforced && blockers.length > 0),
  }
}

/** The one question every entry point asks. Never read registrationOpen directly for this. */
export const registrationIsOpen = () => launchStatus().open

import { event } from './event'
import type { Track } from '../lib/db/types'

export type Speaker = {
  name: string
  role: string
  org: string
  track?: Track
}

/**
 * TODO(vedant): speaker list not confirmed. Deliberately empty, which renders
 * the announced soon state. Adding one entry renders correctly too, so there is
 * no need to wait for a full lineup before publishing the first name.
 */
export const speakers: Speaker[] = []

/** Fixed subject so applications are filterable in the inbox. The landing page carries the same string. */
export const SPEAKER_SUBJECT = 'Speaker - AWS SCD Hyderabad'

export const speakerMailto = `mailto:${event.contactEmail}?subject=${encodeURIComponent(SPEAKER_SUBJECT)}`

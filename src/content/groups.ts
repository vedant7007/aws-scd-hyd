/**
 * Group passes. One person registers everyone, all on the same pass, pays
 * once for the whole group, and every person gets their own pass id. The
 * discount comes off each person's pass.
 *
 * Organiser's decisions: groups of four (6 October 2026), five (7 October)
 * and three (8 October), and every ticket in a group is ₹99 less. Other
 * sizes or amounts change only here.
 */
export const GROUP_MIN: number = 3
export const GROUP_MAX: number = 5

/** Off each person's pass, in paise, from that group size up. Ordered by size. */
export const GROUP_DISCOUNTS: { from: number; offPaise: number }[] = [{ from: 3, offPaise: 9900 }]

/** Group sizes the flow offers. */
export const GROUP_SIZES = Array.from({ length: GROUP_MAX - GROUP_MIN + 1 }, (_, i) => GROUP_MIN + i)

/** Paise off each person for a group of this size; 0 for one person or a size outside the range. */
export function groupOffPaise(size: number): number {
  if (!Number.isInteger(size) || size < GROUP_MIN || size > GROUP_MAX) return 0
  let off = 0
  for (const d of GROUP_DISCOUNTS) if (size >= d.from) off = d.offPaise
  return off
}

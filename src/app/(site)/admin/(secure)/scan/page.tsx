import { Scanner } from '@/components/admin/Scanner'
import { Container } from '@/components/layout/Container'
import { requireAdmin } from '@/lib/auth/admin'
import { listAttendees } from '@/lib/db/queries'
import type { RosterEntry } from '@/lib/scan-queue'

export default async function ScanPage() {
  // Guard first, before the roster is loaded or serialised.
  await requireAdmin()

  const attendees = await listAttendees()

  /**
   * The roster ships with the page and is cached on the device, so a scan still
   * shows a name when the wifi has gone. No pass tokens and no phone numbers
   * are included: the gate needs to identify a person, not contact them.
   */
  const roster: RosterEntry[] = attendees
    .filter((a) => a.paymentStatus === 'paid')
    .map((a) => ({
      ticketRef: a.ticketRef,
      name: a.name,
      tier: a.tier,
      foodPreference: a.foodPreference,
      college: a.college,
    }))

  return (
    <Container className="flex flex-col gap-10 py-12">
      <div>
        <h1 className="display text-step-3">Scan</h1>
        <p className="mt-2 measure text-muted">
          {roster.length} passes cached on this device. Check ins keep working with no network and send
          themselves when it returns.
        </p>
      </div>

      <Scanner roster={roster} />
    </Container>
  )
}

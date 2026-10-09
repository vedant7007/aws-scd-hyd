import { Scanner } from '@/components/admin/Scanner'
import { requireCrew } from '@/lib/auth/admin'
import { listAttendees } from '@/lib/db/queries'
import type { RosterEntry } from '@/lib/scan-queue'
import { programSession } from '@/content/program'

/**
 * The gate. Any crew role: this is the one screen a volunteer is for.
 * requireCrew runs before the roster is loaded or serialised.
 */
export default async function ScanPage() {
  await requireCrew()

  const attendees = await listAttendees()

  /**
   * The roster ships with the page and is cached on the device, so a scan still
   * shows a name and sessions when the wifi has gone. No email addresses and no
   * phone numbers are included: the gate needs to identify a person, not contact them.
   */
  const roster: RosterEntry[] = attendees
    .filter((a) => a.state === 'VERIFIED')
    .map((a) => ({
      passId: a.passId,
      name: a.name,
      tier: a.tier,
      college: a.college,
      technical: programSession(a.technicalSession)?.title ?? a.technicalSession,
      workshop: a.workshop ? (programSession(a.workshop)?.title ?? a.workshop) : null,
      builderId: a.builderId ?? null,
      group: a.groupId ? { size: a.groupSize ?? 0, payer: a.groupId === a.passId } : null,
      checkedIn: Boolean(a.checkedInAt),
    }))

  return (
    <div className="page rise">
      <Scanner roster={roster} />
    </div>
  )
}

import { Scanner } from '@/components/admin/Scanner'
import { requireCrew } from '@/lib/auth/admin'
import { listAttendees } from '@/lib/db/queries'
import type { RosterEntry } from '@/lib/scan-queue'

/**
 * The gate. Any crew role: this is the one screen a volunteer is for.
 * requireCrew runs before the roster is loaded or serialised.
 */
export default async function ScanPage() {
  await requireCrew()

  const attendees = await listAttendees()

  /**
   * The roster ships with the page and is cached on the device, so a scan still
   * shows a name when the wifi has gone. No email addresses and no phone
   * numbers are included: the gate needs to identify a person, not contact them.
   */
  const roster: RosterEntry[] = attendees
    .filter((a) => a.state === 'SESSIONS_SELECTED')
    .map((a) => ({
      passId: a.passId,
      name: a.name,
      tier: a.tier,
      foodPreference: a.foodPreference,
      college: a.college,
    }))

  return (
    <div className="page rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="eye">{'// THE GATE'}</span>
          <h1 className="h1">SCAN</h1>
        </div>
        <span className="lbl">{roster.length} passes cached on this phone</span>
      </div>
      <Scanner roster={roster} />
    </div>
  )
}

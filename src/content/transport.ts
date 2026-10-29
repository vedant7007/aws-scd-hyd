/**
 * VJIT's college bus routes for the event day, from the college's
 * "TRANSPORT DETAILS 2026-27" sheet (shared by the organisers, 29 October
 * 2026). Route number, the area it starts from and its start time. The
 * sheet has no stop list, so attendees pick a route and type their stop.
 * The full sheet, with the drivers, is the PDF below.
 */
export type BusRoute = { no: string; area: string; starts: string }

export const BUS_ROUTES: BusRoute[] = [
  { no: '1', area: 'Nizampet', starts: '7:35 AM' },
  { no: '2', area: 'Hydernagar', starts: '7:45 AM' },
  { no: '3', area: 'Madinaguda', starts: '7:30 AM' },
  { no: '4', area: 'IDPL', starts: '7:30 AM' },
  { no: '5', area: 'AS Rao Nagar', starts: '7:05 AM' },
  { no: '6', area: 'ECIL', starts: '7:20 AM' },
  { no: '7', area: 'Jodimetla', starts: '7:25 AM' },
  { no: '8', area: 'Ramanthapur', starts: '7:15 AM' },
  { no: '9', area: 'LB Nagar', starts: '7:25 AM' },
  { no: '10', area: 'BN Reddy', starts: '7:35 AM' },
  { no: '11', area: 'Alakapuri Colony', starts: '7:50 AM' },
  { no: '12', area: 'Darga', starts: '8:00 AM' },
  { no: '13', area: 'Attapur', starts: '8:00 AM' },
  { no: '14', area: 'Moti Nagar', starts: '7:35 AM' },
  { no: '15', area: 'Suncity', starts: '8:15 AM' },
  { no: '16', area: 'Patancheru', starts: '7:25 AM' },
  { no: '17', area: 'Mehadipatnam', starts: '8:00 AM' },
  { no: '18', area: 'Manikonda', starts: '7:50 AM' },
  { no: '19', area: 'Janapriya (Hyderguda)', starts: '8:00 AM' },
  { no: '20', area: 'Vijaya Nagar Colony', starts: '8:00 AM' },
  { no: '21', area: 'Beeramguda', starts: '7:40 AM' },
  { no: '22', area: 'Sagar X Road', starts: '7:30 AM' },
  { no: '23', area: 'SR Nagar', starts: '7:35 AM' },
  { no: '24', area: 'Alwal', starts: '7:15 AM' },
  { no: '25', area: 'Shadnagar', starts: '7:15 AM' },
  { no: '26', area: 'Sanga Reddy', starts: '7:05 AM' },
  { no: '27', area: 'ODF Shankarpally', starts: '7:35 AM' },
  { no: '28', area: 'Gayathri Nagar', starts: '7:50 AM' },
  { no: '30', area: 'Vikarabad', starts: '7:40 AM' },
  { no: '31', area: 'Vikarabad', starts: '7:40 AM' },
  { no: '32', area: 'Tolichowki', starts: '7:50 AM' },
  { no: '33', area: 'Shamshabad', starts: '7:45 AM' },
]

/** Coming on their own, not by college bus. */
export const OWN_TRANSPORT = 'own'

export const busLabel = (no: string | undefined) => {
  if (!no) return null
  if (no === OWN_TRANSPORT) return 'Own transport'
  const r = BUS_ROUTES.find((x) => x.no === no)
  return r ? `Route ${r.no}, ${r.area} (${r.starts})` : `Route ${no}`
}

export const FOOD = { veg: 'Veg', nonveg: 'Non-veg' } as const
export type Food = keyof typeof FOOD

export const TRANSPORT_PDF = '/assets/vjit-transport-2026-27.pdf'

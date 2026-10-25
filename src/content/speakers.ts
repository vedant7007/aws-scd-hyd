/**
 * The line-up: only people the organisers have announced on Instagram
 * (@awssbg_vjit), as of 25 October 2026. Names, titles and expertise follow
 * those posts; Seshu Venkata is the guest speaker, as announced.
 * Photos are their LinkedIn profile photos.
 *
 * Technical speakers and hands-on leads are not announced yet; the section
 * shows them as revealing soon until they are added here.
 */
export type SpeakerRole = 'chief' | 'panel' | 'technical' | 'workshop'

export type Speaker = {
  name: string
  role: SpeakerRole
  designation: string
  org: string
  /** What they bring, in a line. Ours, from their announcement, never a quote. */
  line: string
  /** Their areas, as the announcement lists them. */
  tags: string[]
  /** A technical session or workshop they take, by id in content/program.ts. */
  session?: string
  /** Under public/. */
  photo?: string
}

export const speakers: Speaker[] = [
  {
    name: 'Seshu Venkata',
    role: 'chief',
    designation: 'Vice President & DMTS Fellow',
    org: 'Wipro',
    line: 'Inspiring insights and industry perspectives for the AWS student community.',
    tags: [],
    photo: '/assets/speakers/seshu.jpg',
  },
  {
    name: 'Kumar Arnesh Rameshwar',
    role: 'panel',
    designation: 'Senior Manager, Public Cloud Security',
    org: 'ServiceNow',
    line: '24 years as an engineering leader, mentor and innovator.',
    tags: ['Cloud Security', 'DevSecOps'],
    photo: '/assets/speakers/arnesh.jpg',
  },
  {
    name: 'Ankita Singh',
    role: 'panel',
    designation: 'Senior Architect',
    org: 'ValueMomentum',
    line: 'Designs cloud-native systems for the enterprise.',
    tags: ['Cloud-Native', 'Azure', 'DevOps'],
    photo: '/assets/speakers/ankita.jpg',
  },
  {
    name: 'Hari Pavan',
    role: 'panel',
    designation: 'Manager, HR & Talent Acquisition',
    org: 'Anarock GCV',
    line: 'The hiring side of the table, and where Gen AI is taking it.',
    tags: ['People & Culture', 'Talent Acquisition', 'Gen AI in HR'],
    photo: '/assets/speakers/hari.jpg',
  },
]

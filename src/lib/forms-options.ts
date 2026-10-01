import { programSession } from '../content/program'

/**
 * The questions on the speaker interest form and the report form. Plain
 * data with no server imports, so the form in the browser renders from
 * exactly the list the server checks against (lib/forms.ts).
 */

export type Question = {
  id: string
  label: string
  kind: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'choice' | 'multi' | 'check'
  required?: boolean
  hint?: string
  placeholder?: string
  /** choice and multi. `group` puts a heading above a run of options. */
  options?: { id: string; label: string; group?: string }[]
  /** textarea: show a live word count. */
  words?: boolean
}

export type Section = { title: string; questions: Question[] }

const YES_NO = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
]

/** The finalised sessions, grouped as the organisers group them. Titles come from content/program.ts. */
const SESSION_OPTIONS = (
  [
    ['t1', 'Beginner', 'CLOUD / AWS'],
    ['t2', 'Intermediate', 'CLOUD / AWS'],
    ['w1', 'Hands-on', 'CLOUD / AWS'],
    ['t4', 'Beginner', 'AI / ML'],
    ['t5', 'Intermediate', 'AI / ML'],
    ['w2', 'Hands-on', 'AI / ML'],
  ] as const
).map(([id, level, group]) => ({ id, label: `${programSession(id)?.title ?? id} · ${level}`, group }))

export const SPEAKER_FORM: Section[] = [
  {
    title: 'SPEAKER INFORMATION',
    questions: [
      { id: 'name', label: 'Full name', kind: 'text', required: true, placeholder: 'As you would like it printed' },
      { id: 'email', label: 'Email address', kind: 'email', required: true, placeholder: 'We reply here' },
      { id: 'phone', label: 'Phone / WhatsApp number', kind: 'tel', required: true, placeholder: '10 digits' },
      { id: 'role', label: 'Current role / designation', kind: 'text', required: true, placeholder: 'e.g. Solutions Architect' },
      { id: 'org', label: 'Organisation / company', kind: 'text', required: true },
      { id: 'linkedin', label: 'LinkedIn profile', kind: 'url', placeholder: 'Optional' },
      { id: 'site', label: 'Personal website / portfolio / GitHub', kind: 'url', placeholder: 'Optional' },
      { id: 'city', label: 'City of residence', kind: 'text', required: true },
      { id: 'bio', label: 'Short bio', kind: 'textarea', hint: '100 to 150 words.', words: true },
    ],
  },
  {
    title: 'SESSION INTEREST',
    questions: [
      { id: 'sessions', label: 'Which session would you be interested in speaking for?', kind: 'multi', required: true, hint: 'The sessions are already set. Pick one or more.', options: SESSION_OPTIONS },
      {
        id: 'level',
        label: 'Preferred session level',
        kind: 'choice',
        required: true,
        options: ['Beginner', 'Intermediate', 'Advanced', 'Hands-on'].map((l) => ({ id: l.toLowerCase(), label: l })),
      },
      { id: 'approach', label: 'Briefly describe how you would approach the selected session.', kind: 'textarea', required: true, hint: '2 to 5 sentences.' },
      { id: 'delivered', label: 'Have you delivered a similar session before?', kind: 'choice', options: YES_NO },
      { id: 'deliveredLink', label: 'If yes, share a link, video or deck, or briefly describe the session.', kind: 'textarea' },
    ],
  },
  {
    title: 'SPEAKING EXPERIENCE',
    questions: [
      { id: 'experience', label: 'Previous speaking experience', kind: 'textarea', required: true, hint: 'Conferences, AWS events, community events, universities, meetups and so on.' },
      { id: 'awsBefore', label: 'Have you previously spoken at an AWS, AWS Community or Student Community event?', kind: 'choice', options: YES_NO },
      { id: 'talkLinks', label: 'Links to previous talks or speaking profiles, if available.', kind: 'textarea' },
    ],
  },
  {
    title: 'AVAILABILITY AND REQUIREMENTS',
    questions: [
      {
        id: 'available',
        label: 'Are you available to attend the event in Hyderabad on 30 October 2026?',
        kind: 'choice',
        required: true,
        options: [...YES_NO, { id: 'unsure', label: 'Not sure yet' }],
      },
      {
        id: 'duration',
        label: 'Are you comfortable with the proposed session duration?',
        kind: 'choice',
        required: true,
        options: [...YES_NO, { id: 'discuss', label: "I'd like to discuss" }],
      },
      { id: 'setup', label: 'Do you have any technical or setup requirements for your session?', kind: 'textarea', hint: 'For example: laptop, HDMI, internet, specific software, AWS account or lab requirements.' },
      { id: 'otherInfo', label: 'Anything else you would like the organising team to know?', kind: 'textarea' },
    ],
  },
  {
    title: 'CONFIRMATION',
    questions: [
      {
        id: 'ack',
        label:
          'I understand that submitting this form only expresses my interest in speaking at AWS Student Community Day Hyderabad 2026 and does not guarantee a speaker slot. The organising team will review submissions and contact shortlisted speakers with the confirmed session, schedule, format and further details.',
        kind: 'check',
        required: true,
      },
    ],
  },
]

export const REPORT_KINDS = [
  { id: 'conduct', label: 'CONDUCT' },
  { id: 'registration', label: 'REGISTRATION' },
  { id: 'payment', label: 'PAYMENT' },
  { id: 'other', label: 'SOMETHING ELSE' },
] as const

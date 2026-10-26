/**
 * The line-up: only people the organisers have announced on Instagram
 * (@awssbg_vjit), as of 26 October 2026. Names, titles and expertise follow
 * those posts; Seshu Venkata is the guest speaker, as announced.
 * Photos: LinkedIn profile photos, and for the 'speaker' role, cropped from
 * their announcement posters.
 *
 * 'speaker' is announced but not yet tied to a session. Which talk or
 * workshop each takes is not announced; give them a session id once it is.
 */
export type SpeakerRole = 'chief' | 'panel' | 'speaker' | 'technical' | 'workshop'

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
  {
    name: 'Tirupathi Kumar Chandra',
    role: 'speaker',
    designation: 'Senior Engineering Manager',
    org: 'Lloyds Banking',
    line: 'Engineering leader at Lloyds Banking and a Certified Toastmasters member.',
    tags: ['Engineering Leadership', 'Toastmasters'],
    photo: '/assets/speakers/tirupathi-v3.jpg',
  },
  {
    name: 'Varsha Verma',
    role: 'speaker',
    designation: 'Lead Cloud Engineer · AWS Community Builder',
    org: 'Accenture',
    line: 'Tech speaker, blogger and AWS cloud trainer.',
    tags: ['AWS', 'Linux', 'DevOps', 'Terraform'],
    photo: '/assets/speakers/varsha-cut.jpg',
  },
  {
    name: 'Pushkar Prasad',
    role: 'speaker',
    designation: 'Senior Vice President',
    org: 'DBS Bank India',
    line: 'Keeps banking systems reliable, from SRE to technology risk management.',
    tags: ['SRE', 'DevOps', 'Technology Risk'],
    photo: '/assets/speakers/pushkar-cut.jpg',
  },
  {
    name: 'Naveen Kumar Kalapala',
    role: 'speaker',
    designation: 'Cloud Infrastructure & DevSecOps Lead',
    org: 'Infosys',
    line: 'Technical writer on platform engineering and AI infrastructure.',
    tags: ['Azure', 'AWS', 'Terraform', 'Cloud Security'],
    photo: '/assets/speakers/naveen-cut.jpg',
  },
  {
    name: 'Dr. Madhu Oruganti',
    role: 'speaker',
    designation: 'Data Scientist · AWS Certified Machine Learning Engineer',
    org: 'KL University Hyderabad',
    line: 'Works across computer vision, data science and machine learning on AWS.',
    tags: ['Computer Vision', 'Machine Learning', 'AWS'],
    photo: '/assets/speakers/madhu-v3.jpg',
  },
]

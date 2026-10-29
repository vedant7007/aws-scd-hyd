/**
 * The final line-up, as the event posters of 30 October 2026 name it: guest
 * speakers, tech talks, the panel and the two hands-on leads. Titles follow
 * the posters; lines are ours, never quotes. Photos are cut from the posters
 * or, where we had one already, LinkedIn. Ritish Venkat Jogi is a guest
 * speaker and a panelist, so he is listed twice. A speaker without a photo
 * shows their initials.
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
    name: 'Sitaram Tadepalli',
    role: 'chief',
    designation: 'Senior Vice President, AI Engineering',
    org: 'DBS Bank',
    line: 'Leads AI and ML engineering at DBS, from generative AI to MLOps.',
    tags: [],
    photo: '/assets/speakers/sitaram.jpg',
  },
  {
    name: 'Narane Gundabathula',
    role: 'chief',
    designation: 'Director, People Operations',
    org: 'Storable India',
    line: '20+ years in HR and talent acquisition.',
    tags: [],
    photo: '/assets/speakers/narane.jpg',
  },
  {
    name: 'Pavan Kumar Allu',
    role: 'chief',
    designation: 'Technology Head · Cloud Practice Lead',
    org: 'TCS',
    line: 'AWS and digital architecture at TCS, and a member of the IEEE ExCom.',
    tags: [],
    photo: '/assets/speakers/pavan.jpg',
  },
  {
    name: 'Ritish Venkat Jogi',
    role: 'chief',
    designation: 'AI Manager · Leader, Microsoft AI Innovators Hub',
    org: 'Blend360',
    line: 'Generative AI and data science at Blend360, and leads a Hyderabad AI community. Also on the panel.',
    tags: [],
    photo: '/assets/speakers/ritish.jpg',
  },
  {
    name: 'Varsha Verma',
    role: 'speaker',
    designation: 'Lead Cloud Engineer · AWS Community Builder',
    org: 'Accenture',
    line: 'Cloud trainer, blogger and tech speaker, followed by 13K+ on LinkedIn.',
    tags: ['AWS', 'Linux', 'DevOps', 'Terraform'],
    photo: '/assets/speakers/varsha-cut.jpg',
  },
  {
    name: 'Naveen Kumar Kalapala',
    role: 'speaker',
    designation: 'Cloud Infrastructure & DevSecOps Lead',
    org: 'Infosys',
    line: 'Landing zones, CI/CD and cloud security on Azure and AWS, automated with Terraform.',
    tags: ['Azure', 'AWS', 'Terraform', 'DevSecOps'],
    photo: '/assets/speakers/naveen-cut.jpg',
  },
  {
    name: 'Dr. Madhu Oruganti',
    role: 'speaker',
    designation: 'AWS ML Engineer · Data Scientist',
    org: 'KL University Hyderabad',
    line: 'PhD in computer vision, teaching and building machine learning.',
    tags: ['Computer Vision', 'Machine Learning', 'AWS'],
    photo: '/assets/speakers/madhu-v3.jpg',
  },
  {
    name: 'Tirupathi Kumar Chandra',
    role: 'speaker',
    designation: 'Senior Engineering Manager',
    org: 'Lloyds Banking',
    line: 'Engineering leader at Lloyds Technology Centre India and a Certified Toastmaster.',
    tags: ['Engineering Leadership', 'Toastmasters'],
    photo: '/assets/speakers/tirupathi-v3.jpg',
  },
  {
    name: 'Ritish Venkat Jogi',
    role: 'panel',
    designation: 'AI Manager',
    org: 'Blend360',
    line: 'Leads the Microsoft AI Innovators Hub in Hyderabad.',
    tags: ['GenAI', 'Data Science'],
    photo: '/assets/speakers/ritish.jpg',
  },
  {
    name: 'Prof. A Ramakrishna Prasad',
    role: 'panel',
    designation: 'Chairman, CSI Hyderabad Chapter',
    org: 'JNTU Hyderabad',
    line: 'Professor at JNTU Hyderabad and former Director of its University Industry Interaction Centre.',
    tags: ['Academia', 'Industry'],
    photo: '/assets/speakers/ramakrishna.jpg',
  },
  {
    name: 'Hari Pavan',
    role: 'panel',
    designation: 'Manager, HR & Talent Acquisition',
    org: 'Anarock GCV',
    line: 'People and culture partner, hiring and growing talent.',
    tags: ['Talent Acquisition', 'Talent Management'],
    photo: '/assets/speakers/hari.jpg',
  },
  {
    name: 'Deepak Kumar Sahu',
    role: 'panel',
    designation: 'Senior Manager, Engineering',
    org: 'Storable',
    line: '13+ years in platform engineering, cloud, DevOps and MLOps.',
    tags: ['Platform', 'DevOps', 'MLOps'],
    photo: '/assets/speakers/deepak.jpg',
  },
  {
    name: 'Pushkar Prasad',
    role: 'panel',
    designation: 'Senior Vice President',
    org: 'DBS Bank',
    line: 'Keeps banking systems reliable, from SRE to DevOps and technology risk.',
    tags: ['SRE', 'DevOps', 'Technology Risk'],
    photo: '/assets/speakers/pushkar-cut.jpg',
  },
  {
    name: 'Avinash Reddy Thipparthi',
    role: 'workshop',
    session: 'w1',
    designation: 'Founder & Lead Cloud Educator',
    org: 'Aviz Academy',
    line: 'AWS Community Builder and Docker Captain, teaching cloud hands-on.',
    tags: ['AWS', 'Docker', 'Cloud'],
    photo: '/assets/speakers/avinash.jpg',
  },
  {
    name: 'Srikar Kokkula',
    role: 'workshop',
    session: 'w2',
    designation: 'Agentic AI Engineer',
    org: 'Virtusa',
    line: 'Builds multi-agent systems with LLMs, RAG pipelines and LangGraph.',
    tags: ['Agentic AI', 'LLMs', 'RAG'],
    photo: '/assets/speakers/srikar.jpg',
  },
]

/** "Ritish Venkat Jogi" as "RJ", for a speaker without a photo. */
export const initials = (name: string) =>
  name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i, all) => (i === 0 || i === all.length - 1 ? w[0] : ''))
    .join('')
    .toUpperCase()

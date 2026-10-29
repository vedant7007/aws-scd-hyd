/**
 * The line-up, as the organisers confirmed it on the morning of 30 October
 * 2026: guest speakers, panelists, speakers and the two hands-on leads.
 * Names, titles and lines follow the organiser's list; lines are ours, never
 * quotes. Photos: LinkedIn, announcement posters and the speakers document.
 * A speaker without a photo shows their initials until one is supplied.
 *
 * The official agenda (content/schedule.ts) names a different panel; this is
 * the list the organiser gave for the website.
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
    line: '26+ years in tech. Center Head of Wipro Hyderabad and Chairperson of its Distinguished Member of Technical Staff program.',
    tags: [],
    photo: '/assets/speakers/seshu.jpg',
  },
  {
    name: 'Sai Ram Bommaraju',
    role: 'chief',
    designation: 'Executive Director, Head of Wealth Management Technology',
    org: 'DBS Tech India',
    line: 'Won AI in Banking & Process Automation at the World AI Awards 2026, and sees agentic AI as a new operating model for wealth management.',
    tags: [],
  },
  {
    name: 'Ankita Singh',
    role: 'panel',
    designation: 'Senior Architect',
    org: 'ValueMomentum',
    line: 'Ex-Microsoft consultant who designs cloud-native, scalable systems for the enterprise.',
    tags: ['Azure', 'DevOps', 'Cloud-Native'],
    photo: '/assets/speakers/ankita.jpg',
  },
  {
    name: 'Kumar Arnesh Rameshwar',
    role: 'panel',
    designation: 'Senior Manager, Public Cloud Security',
    org: 'ServiceNow',
    line: '24 years as an engineering leader, speaker, mentor and patent holder.',
    tags: ['Cloud Security', 'DevSecOps'],
    photo: '/assets/speakers/arnesh.jpg',
  },
  {
    name: 'Hari Pavan',
    role: 'panel',
    designation: 'Manager, HR & Talent Acquisition',
    org: 'Anarock GCV',
    line: 'Hiring across Flipkart, Jio and Anarock, and bringing Gen AI into HR.',
    tags: ['Talent Acquisition', 'Gen AI in HR'],
    photo: '/assets/speakers/hari.jpg',
  },
  {
    name: 'Tajamul Khan',
    role: 'speaker',
    designation: 'Data Scientist · Public Speaker',
    org: 'Stolt-Nielsen',
    line: 'Ex-Google and Amazon, writing about data and AI for 240K+ on LinkedIn.',
    tags: ['Data Science', 'AI', 'Microsoft Fabric'],
    photo: '/assets/speakers/tajamul.jpg',
  },
  {
    name: 'Naveen Kumar Kalapala',
    role: 'speaker',
    designation: 'Cloud Infrastructure & DevSecOps Lead',
    org: 'Infosys',
    line: 'Landing zones, CI/CD and cloud security on Azure and AWS, automated with Terraform.',
    tags: ['Azure', 'AWS', 'Terraform', 'Cloud Security'],
    photo: '/assets/speakers/naveen-cut.jpg',
  },
  {
    name: 'Dr. Madhu Oruganti',
    role: 'speaker',
    designation: 'Assistant Professor · AWS Certified ML Engineer',
    org: 'KL University Hyderabad',
    line: 'PhD from NIT Raipur, with research in computer vision and 100+ citations.',
    tags: ['Computer Vision', 'Machine Learning', 'AWS'],
    photo: '/assets/speakers/madhu-v3.jpg',
  },
  {
    name: 'Varsha Verma',
    role: 'speaker',
    designation: 'Lead Cloud Engineer · AWS Community Builder',
    org: 'Accenture',
    line: 'LinkedIn Top Voice for Cloud and DevOps, and a speaker at AWS Community Days.',
    tags: ['AWS', 'DevOps', 'Zero Trust'],
    photo: '/assets/speakers/varsha-cut.jpg',
  },
  {
    name: 'Pushkar Prasad',
    role: 'speaker',
    designation: 'Senior Vice President',
    org: 'DBS Bank India',
    line: 'Keeps banking systems reliable, from SRE to technology risk and debt management.',
    tags: ['SRE', 'DevOps', 'Technology Risk'],
    photo: '/assets/speakers/pushkar-cut.jpg',
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
    name: 'Sitaram Tadepalli',
    role: 'speaker',
    designation: 'SVP, Machine Learning Engineering',
    org: 'DBS Tech India',
    line: '20+ years in data science, leading AI engineering and model governance across DBS.',
    tags: ['Machine Learning', 'MLOps', 'AI Governance'],
  },
  {
    name: 'Ritish Venkat Jogi',
    role: 'speaker',
    designation: 'AI Manager · Co-lead, Microsoft AI Innovators Hub',
    org: 'Blend360',
    line: 'Builds AI and data science work at Blend360 and co-leads a Hyderabad AI community.',
    tags: ['AI', 'Data Science', 'Community'],
  },
  {
    name: 'Avinash Reddy Thipparthi',
    role: 'workshop',
    session: 'w1',
    designation: 'Founder & Lead Cloud Educator · AWS Community Builder',
    org: 'Aviz Academy',
    line: 'Docker Captain with 8 AWS certifications, teaching cloud hands-on.',
    tags: ['AWS', 'Docker', 'Cloud'],
  },
  {
    name: 'Srikar Kokkula',
    role: 'workshop',
    session: 'w2',
    designation: 'Agentic AI Engineer',
    org: 'Virtusa',
    line: 'Builds multi-agent systems with LLMs, RAG and LangGraph.',
    tags: ['Agentic AI', 'LLMs', 'RAG'],
  },
]

/** "Sai Ram Bommaraju" as "SB", for a speaker without a photo. */
export const initials = (name: string) =>
  name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i, all) => (i === 0 || i === all.length - 1 ? w[0] : ''))
    .join('')
    .toUpperCase()

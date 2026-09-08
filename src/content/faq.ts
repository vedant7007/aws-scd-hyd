export type FaqItem = {
  q: string
  a: string
}

/**
 * TODO(vedant): FAQ copy is not signed off. Every answer below is restricted to
 * something already settled in SPEC.md, so nothing here invents a policy. Add,
 * cut or rewrite freely. An empty array renders nothing and breaks nothing.
 */
export const faq: FaqItem[] = [
  {
    q: 'Do I need an account to attend?',
    a: 'No. There is no login. Your confirmation email contains a private pass link, and that link is your ticket and your session picker.',
  },
  {
    q: 'I lost my pass link.',
    a: 'Search your inbox for the confirmation email. If you cannot find it, write to us and we will resend it.',
  },
  {
    q: 'Is lunch included?',
    a: 'Yes, on every pass tier. You tell us your food preference when you register.',
  },
  {
    q: 'How do I pick my sessions?',
    a: 'Open your pass link and choose one session per time slot. Seats are limited per hall, and a hall can fill up while you are deciding.',
  },
  {
    q: 'Can I change a session after I have picked it?',
    a: 'Yes, as long as the session you are moving to still has a free seat. Your old seat is released at the same moment the new one is taken.',
  },
  {
    q: 'Is this an AWS event?',
    a: 'No. AWS User Groups are run by independent volunteers and are not organized by AWS.',
  },
]

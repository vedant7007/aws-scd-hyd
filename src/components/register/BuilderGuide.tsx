import { BUILDER_SIGNUP } from '@/content/builder'

const STEPS = [
  { title: 'Open the link', text: 'Tap Create one free. It opens AWS Builder Center in a new tab.' },
  { title: 'Create your ID', text: 'Choose Sign in, then Create AWS Builder ID. Enter your email and your name.' },
  { title: 'Verify your email', text: 'Type in the code AWS sends to your inbox, then set a password.' },
  { title: 'Pick your @username', text: 'When it asks for an alias, choose one. That alias is your Builder ID.' },
] as const

/**
 * How to get an AWS Builder ID, as numbered cards, plus where an existing
 * one lives: a small drawing of the Manage profile screen with the @username
 * on it. Used under the registration box and on the add-it-later page.
 */
export function BuilderGuide() {
  return (
    <div className="bg-guide">
      <div className="bg-head">
        <span className="bg-title">NO BUILDER ID YET?</span>
        <a href={BUILDER_SIGNUP} target="_blank" rel="noopener" className="bg-cta">
          {'CREATE ONE FREE >'}
        </a>
        <span className="bg-sub">Free · about 2 minutes</span>
      </div>
      <ol className="bg-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-step">
            <span className="bg-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="bg-step-t">{s.title}</span>
            <span className="bg-step-x">{s.text}</span>
          </li>
        ))}
      </ol>
      <div className="bg-have">
        <span className="bg-have-t">ALREADY HAVE ONE?</span>
        <span className="bg-have-x">Sign in at builder.aws.com, click your name at the top right, then Manage profile. Your @username is right there.</span>
        <span className="bg-mock" aria-hidden="true">
          <span className="bg-mock-bar">
            <span>builder.aws.com</span>
            <span className="bg-mock-avatar">A</span>
          </span>
          <span className="bg-mock-menu">
            <span className="bg-mock-item">My profile</span>
            <span className="bg-mock-item" data-on="1">Manage profile</span>
            <span className="bg-mock-item">Sign out</span>
          </span>
          <span className="bg-mock-alias">
            Alias <strong>@yourname</strong>
            <span className="bg-mock-arrow">{'< this one'}</span>
          </span>
        </span>
      </div>
      <span className="bg-back">Then come back and type the @username in the box.</span>
    </div>
  )
}

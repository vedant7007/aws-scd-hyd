import { event } from './event'

/**
 * The certificate of participation. Earned by filling the AWS event survey
 * and proving it on /certificate with the submission ID and a screenshot.
 */
export const certificate = {
  survey: 'https://pulse.amazon/survey/UPCU4UQO?p=0',
  title: 'Certificate of Participation',
  /** What LinkedIn shows as the certification's name. */
  linkedinName: `${event.name} 2026`,
  issuer: event.host,
  issued: { year: 2026, month: 10, label: '30 October 2026' },
  /**
   * TODO(vedant): who signs it, name and title each. Empty means the
   * certificate shows no signature lines.
   */
  signatories: [] as { name: string; title: string }[],
}

/** A submission ID as the survey's "My Submissions" page shows it: SurveySubmission-3LYem6zCSA8MFVgny7JCLDzYGxh. */
export const SURVEY_ID = /^SurveySubmission-[A-Za-z0-9]{16,48}$/

/** What someone pasted, to the one form the table knows: no spaces, no "ID:" in front. */
export function normaliseSurveyId(input: string): string | null {
  const bare = input.replace(/\s+/g, '').replace(/^ID:/i, '')
  const m = /SurveySubmission-[A-Za-z0-9]+/i.exec(bare)
  if (!m) return null
  const id = 'SurveySubmission-' + m[0].slice('SurveySubmission-'.length)
  return SURVEY_ID.test(id) ? id : null
}

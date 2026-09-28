/**
 * /register carries its own chrome, as the v3 handoff draws it: a header with
 * the wordmark, the theme toggle, a way home and a way to the passes, and no
 * site footer. The page renders all of it, so this layout only lays the
 * shared page background behind it.
 */
export default function RegisterLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <div className="page-bg" aria-hidden="true" />
      {children}
    </>
  )
}

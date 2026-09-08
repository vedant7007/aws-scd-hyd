import { Container } from '@/components/layout/Container'
import { about } from '@/content/event'

export function About() {
  return (
    <section id="about" className="border-t border-border">
      <Container className="py-20 sm:py-28">
        <div className="measure flex flex-col gap-6 text-step-1">
          {about.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Container>
    </section>
  )
}

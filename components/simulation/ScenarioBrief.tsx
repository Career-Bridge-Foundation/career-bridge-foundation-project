type Props = {
  brief: string
}

export default function ScenarioBrief({ brief }: Props) {
  const paragraphs = brief.split('\n\n').filter(Boolean)

  return (
    <section aria-label="Scenario brief">
      <h2 className="text-xl font-semibold text-text-primary mb-4">Scenario Brief</h2>

      <div className="space-y-4 text-base text-text-primary leading-relaxed">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <p className="mt-6 text-sm text-text-muted border-l-2 border-brand-accent pl-3">
        This brief is available throughout the simulation for reference.
      </p>
    </section>
  )
}

type Props = {
  current: number
  total: number
}

export default function PromptProgress({ current, total }: Props) {
  const percent = Math.round((current / total) * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">
          Step {current} of {total}
        </span>
        <span className="text-xs text-text-muted">{percent}% complete</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-accent transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

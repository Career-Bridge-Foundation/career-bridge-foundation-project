'use client'

import { ErrorFallback } from '../_error-fallback'

export default function SimulationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorFallback error={error} reset={reset} title="Could not load simulations" />
}

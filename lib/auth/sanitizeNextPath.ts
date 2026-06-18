export function sanitizeNextPath(nextValue: string | null): string {
  if (!nextValue) return '/'
  if (!nextValue.startsWith('/')) return '/'
  if (nextValue.startsWith('//')) return '/'
  if (nextValue.includes('\\')) return '/'   // reject backslash open-redirect tricks
  return nextValue
}

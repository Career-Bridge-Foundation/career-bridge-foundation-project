/** Lightweight className joiner. Filters falsy values and concatenates. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

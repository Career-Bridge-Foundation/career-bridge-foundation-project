import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Lightweight className joiner. Accepts the same arguments as `clsx`
 * and merges Tailwind classes via `tailwind-merge`.
 */
export function cn(...inputs: Parameters<typeof clsx>): string {
  return twMerge(clsx(...inputs))
}

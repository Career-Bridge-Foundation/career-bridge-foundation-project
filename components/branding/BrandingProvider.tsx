'use client'

import { createContext, useContext } from 'react'
import type { PartnerBranding } from '@/lib/partners/branding'

/**
 * Branding context for Spec 05.4 Phase 2. The value is resolved server-side in
 * the (branded) layout from the x-partner-* request headers (set by the Phase 1
 * middleware) and passed down here. This provider holds the value only — it does
 * NOT fetch. `null` means neutral (apex / unknown subdomain / no partner).
 */
const BrandingContext = createContext<PartnerBranding | null>(null)

export function BrandingProvider({
  value,
  children,
}: {
  value: PartnerBranding | null
  children: React.ReactNode
}) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

/** Read the current partner branding, or null when neutral. */
export function useBranding(): PartnerBranding | null {
  return useContext(BrandingContext)
}

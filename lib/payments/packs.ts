import { supabaseServer } from '@/lib/supabase/server'
import type { PricingRegion } from '@/lib/entitlement/pricingRegion'

export type Pack = 'builder' | 'professional'

export const PACKS: Record<Pack, { label: string; credits: number }> = {
  builder: { label: 'Builder', credits: 3 },
  professional: { label: 'Professional', credits: 10 },
}

/**
 * Resolves the Stripe Price ID for a (partner, region, pack) combination.
 * Reads partner_pack_prices — never derives a price from client input.
 * Returns null if no price is configured for that combination (caller
 * maps to a 4xx — this is a config gap, not a candidate error).
 */
export async function resolvePackPrice(
  partnerId: string,
  region: PricingRegion,
  pack: Pack
): Promise<{ stripePriceId: string } | null> {
  const { data, error } = await supabaseServer
    .from('partner_pack_prices')
    .select('stripe_price_id')
    .eq('partner_id', partnerId)
    .eq('pricing_region', region)
    .eq('pack', pack)
    .maybeSingle()

  if (error) throw new Error(`partner_pack_prices query failed: ${error.message}`)
  if (!data) return null

  return { stripePriceId: data.stripe_price_id as string }
}

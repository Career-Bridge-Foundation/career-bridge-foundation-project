import type { SupabaseClient } from '@supabase/supabase-js';
import { generateUniqueSlug } from './slug';

export async function ensurePortfolioProfile(
  userId: string,
  displayName: string,
  supabase: SupabaseClient
): Promise<void> {
  const { data: existing } = await supabase
    .from('portfolio_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return;

  const slug = await generateUniqueSlug(displayName, userId, supabase);

  const { error } = await supabase
    .from('portfolio_profiles')
    .insert({ user_id: userId, slug });

  if (error) {
    throw new Error(`portfolio_profiles insert failed: ${error.message}`);
  }
}

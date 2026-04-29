-- Adds UPDATE RLS policy to evaluation_results
-- Fixes silent upsert failure on simulation re-evaluation
-- See: docs/DATABASE.md section 4 (Known bug callout to be removed after this migration ships)

CREATE POLICY "Users can update own results"
  ON public.evaluation_results
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

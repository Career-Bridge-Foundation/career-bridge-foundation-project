-- ============================================================
-- Career Bridge Foundation
-- Migration: 20260518_003_simulation_bucket.sql
--
-- Storage RLS policies for the simulation-submissions bucket.
--
-- IMPORTANT: The bucket itself must be created manually in the
-- Supabase Dashboard before applying these policies:
--   Name:            simulation-submissions
--   Public:          false
--   File size limit: 10 MB (10485760 bytes)
--   Allowed MIME types (optional, bucket-level):
--     application/pdf
--     application/msword
--     application/vnd.openxmlformats-officedocument.wordprocessingml.document
--     image/png, image/jpeg, image/gif, image/webp
--     text/csv
--     application/vnd.ms-excel
--     application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
--     application/vnd.ms-powerpoint
--     application/vnd.openxmlformats-officedocument.presentationml.presentation
--
-- File path structure: {user_id}/{session_id}/{task_id}/{timestamp}_{filename}
-- ============================================================

-- Candidates can upload their own files (first path segment = their user_id)
CREATE POLICY "storage_simulation_submissions_candidate_upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'simulation-submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Candidates can read back their own uploads
CREATE POLICY "storage_simulation_submissions_candidate_read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'simulation-submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Candidates can replace (update) their own uploads
CREATE POLICY "storage_simulation_submissions_candidate_update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'simulation-submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Candidates can delete their own uploads
CREATE POLICY "storage_simulation_submissions_candidate_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'simulation-submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read all simulation submissions
CREATE POLICY "storage_simulation_submissions_admin_read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'simulation-submissions'
    AND is_admin()
  );

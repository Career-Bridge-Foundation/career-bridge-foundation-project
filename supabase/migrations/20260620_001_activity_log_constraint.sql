-- ── simulation_activity: widen action CHECK constraint ────────────────────────
-- The original constraint only allowed four values. We now log status_changed
-- (workflow transitions) and updated_rubric from the CMS.

ALTER TABLE simulation_activity
  DROP CONSTRAINT IF EXISTS simulation_activity_action_check;

ALTER TABLE simulation_activity
  ADD CONSTRAINT simulation_activity_action_check
  CHECK (action IN (
    'created',
    'updated_metadata',
    'updated_content',
    'updated_rubric',
    'deleted',
    'status_changed'
  ));

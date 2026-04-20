-- ============================================================
-- Career Bridge Foundation — Initial Schema
-- Migration: 20260420_001_create_all_tables.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE 1: profiles
-- Extends auth.users with app-specific fields.
-- Auto-populated via trigger on auth.users INSERT.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  user_type   TEXT NOT NULL DEFAULT 'candidate'
                CHECK (user_type IN ('candidate', 'coach', 'admin')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- TABLE 2: simulation_sessions
-- One row per user per simulation slug. Tracks progress status.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.simulation_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_slug  TEXT        NOT NULL,
  discipline       TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, simulation_slug)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 3: simulation_responses
-- One row per task per session. Stores typed text, file
-- metadata, and link URLs for each of the 5 tasks.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.simulation_responses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES public.simulation_sessions(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_number    INTEGER     NOT NULL CHECK (task_number >= 1 AND task_number <= 5),
  response_text  TEXT,
  file_urls      TEXT[],
  link_urls      TEXT[],
  saved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, task_number)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 4: evaluation_results
-- Full Claude evaluation output. One row per session.
-- task_scores and criteria_scores are JSONB for flexibility.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.evaluation_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES public.simulation_sessions(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_slug  TEXT        NOT NULL,
  verdict_band     TEXT        NOT NULL
                     CHECK (verdict_band IN ('Distinction', 'Merit', 'Pass', 'Borderline', 'Did Not Pass')),
  overall_score    NUMERIC(5,2),
  task_scores      JSONB       NOT NULL,
  criteria_scores  JSONB       NOT NULL,
  feedback_text    TEXT,
  raw_evaluation   JSONB       NOT NULL,
  evaluated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 5: coaches
-- One row per coach user. Tracks org, seat limit, Stripe link.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.coaches (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_name  TEXT,
  max_seats          INTEGER     NOT NULL DEFAULT 10,
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE 6: coach_candidates
-- Invite-based relationship between a coach and a candidate.
-- candidate_user_id is NULL until the invite is accepted.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.coach_candidates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            UUID        NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  candidate_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_email        TEXT        NOT NULL,
  invite_token        TEXT        NOT NULL UNIQUE,
  invite_status       TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (invite_status IN ('pending', 'accepted', 'revoked')),
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at         TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────
-- TABLE 7: simulation_assignments
-- Coach assigns a specific simulation to a specific candidate.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.simulation_assignments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            UUID        NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  candidate_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id       TEXT        NOT NULL,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, candidate_user_id, simulation_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 8: coach_notes
-- Private coach notes per candidate per simulation.
-- shared_with_candidate controls candidate visibility.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.coach_notes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id              UUID        NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  candidate_user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id         TEXT        NOT NULL,
  note_content          TEXT,
  shared_with_candidate BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, candidate_user_id, simulation_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE 9: credential_issuances
-- Tracks Certifier credential per candidate per simulation.
-- certifier_credential_id and _url populated after API call.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.credential_issuances (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id                 UUID        REFERENCES public.coaches(id) ON DELETE SET NULL,
  simulation_id            TEXT        NOT NULL,
  certifier_credential_id  TEXT,
  certifier_credential_url TEXT,
  issued_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                   TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'issued', 'failed')),
  UNIQUE(candidate_user_id, simulation_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_candidates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_issuances  ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── simulation_sessions ──────────────────────────────────────
CREATE POLICY "Users can view own sessions"
  ON public.simulation_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.simulation_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.simulation_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Coaches can read sessions of their accepted candidates
CREATE POLICY "Coaches can view candidate sessions"
  ON public.simulation_sessions FOR SELECT
  USING (user_id IN (
    SELECT cc.candidate_user_id
    FROM public.coach_candidates cc
    JOIN public.coaches c ON cc.coach_id = c.id
    WHERE c.user_id = auth.uid()
      AND cc.invite_status = 'accepted'
  ));

-- ── simulation_responses ─────────────────────────────────────
CREATE POLICY "Users can view own responses"
  ON public.simulation_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own responses"
  ON public.simulation_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own responses"
  ON public.simulation_responses FOR UPDATE
  USING (auth.uid() = user_id);

-- Coaches can read responses of their accepted candidates
CREATE POLICY "Coaches can view candidate responses"
  ON public.simulation_responses FOR SELECT
  USING (user_id IN (
    SELECT cc.candidate_user_id
    FROM public.coach_candidates cc
    JOIN public.coaches c ON cc.coach_id = c.id
    WHERE c.user_id = auth.uid()
      AND cc.invite_status = 'accepted'
  ));

-- ── evaluation_results ───────────────────────────────────────
CREATE POLICY "Users can view own results"
  ON public.evaluation_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results"
  ON public.evaluation_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Coaches can read results of their accepted candidates
CREATE POLICY "Coaches can view candidate results"
  ON public.evaluation_results FOR SELECT
  USING (user_id IN (
    SELECT cc.candidate_user_id
    FROM public.coach_candidates cc
    JOIN public.coaches c ON cc.coach_id = c.id
    WHERE c.user_id = auth.uid()
      AND cc.invite_status = 'accepted'
  ));

-- ── coaches ──────────────────────────────────────────────────
CREATE POLICY "Coaches can view own record"
  ON public.coaches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Coaches can update own record"
  ON public.coaches FOR UPDATE
  USING (auth.uid() = user_id);

-- ── coach_candidates ─────────────────────────────────────────
CREATE POLICY "Coaches can manage own candidates"
  ON public.coach_candidates FOR ALL
  USING (coach_id IN (
    SELECT id FROM public.coaches WHERE user_id = auth.uid()
  ));

-- ── simulation_assignments ───────────────────────────────────
CREATE POLICY "Coaches can manage own assignments"
  ON public.simulation_assignments FOR ALL
  USING (coach_id IN (
    SELECT id FROM public.coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Candidates can view own assignments"
  ON public.simulation_assignments FOR SELECT
  USING (auth.uid() = candidate_user_id);

-- ── coach_notes ──────────────────────────────────────────────
CREATE POLICY "Coaches can manage own notes"
  ON public.coach_notes FOR ALL
  USING (coach_id IN (
    SELECT id FROM public.coaches WHERE user_id = auth.uid()
  ));

-- Candidates only see notes explicitly shared with them
CREATE POLICY "Candidates can view shared notes"
  ON public.coach_notes FOR SELECT
  USING (auth.uid() = candidate_user_id AND shared_with_candidate = true);

-- ── credential_issuances ─────────────────────────────────────
CREATE POLICY "Candidates can view own credentials"
  ON public.credential_issuances FOR SELECT
  USING (auth.uid() = candidate_user_id);

CREATE POLICY "Coaches can view own candidate credentials"
  ON public.credential_issuances FOR SELECT
  USING (coach_id IN (
    SELECT id FROM public.coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Coaches can insert credentials"
  ON public.credential_issuances FOR INSERT
  WITH CHECK (coach_id IN (
    SELECT id FROM public.coaches WHERE user_id = auth.uid()
  ));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_simulation_sessions_user      ON public.simulation_sessions(user_id);
CREATE INDEX idx_simulation_sessions_slug      ON public.simulation_sessions(simulation_slug);
CREATE INDEX idx_simulation_responses_session  ON public.simulation_responses(session_id);
CREATE INDEX idx_simulation_responses_user     ON public.simulation_responses(user_id);
CREATE INDEX idx_evaluation_results_session    ON public.evaluation_results(session_id);
CREATE INDEX idx_evaluation_results_user       ON public.evaluation_results(user_id);
CREATE INDEX idx_coaches_user                  ON public.coaches(user_id);
CREATE INDEX idx_coach_candidates_coach        ON public.coach_candidates(coach_id);
CREATE INDEX idx_coach_candidates_candidate    ON public.coach_candidates(candidate_user_id);
CREATE INDEX idx_coach_candidates_token        ON public.coach_candidates(invite_token);
CREATE INDEX idx_simulation_assignments_coach  ON public.simulation_assignments(coach_id);
CREATE INDEX idx_simulation_assignments_candidate ON public.simulation_assignments(candidate_user_id);
CREATE INDEX idx_coach_notes_coach             ON public.coach_notes(coach_id);
CREATE INDEX idx_coach_notes_candidate         ON public.coach_notes(candidate_user_id);
CREATE INDEX idx_credential_issuances_candidate ON public.credential_issuances(candidate_user_id);
CREATE INDEX idx_credential_issuances_coach    ON public.credential_issuances(coach_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_simulation_sessions_updated_at
  BEFORE UPDATE ON public.simulation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_coaches_updated_at
  BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_coach_notes_updated_at
  BEFORE UPDATE ON public.coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

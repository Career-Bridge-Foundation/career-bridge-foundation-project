// ============================================================
// Career Bridge Foundation — Database Types
// Auto-matched to: supabase/migrations/20260420_001_create_all_tables.sql
// ============================================================

// ── profiles ─────────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string | null
  user_type: 'candidate' | 'coach' | 'admin'
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface ProfileInsert {
  id: string
  full_name?: string | null
  user_type?: 'candidate' | 'coach' | 'admin'
  avatar_url?: string | null
}

export interface ProfileUpdate {
  full_name?: string | null
  user_type?: 'candidate' | 'coach' | 'admin'
  avatar_url?: string | null
}

// ── simulation_sessions ──────────────────────────────────────

export type SimulationStatus = 'in_progress' | 'submitted' | 'evaluated'

export interface SimulationSession {
  id: string
  user_id: string
  simulation_slug: string
  discipline: string
  status: SimulationStatus
  started_at: string
  submitted_at: string | null
  updated_at: string
}

export interface SimulationSessionInsert {
  user_id: string
  simulation_slug: string
  discipline: string
  status?: SimulationStatus
  submitted_at?: string | null
}

export interface SimulationSessionUpdate {
  status?: SimulationStatus
  submitted_at?: string | null
}

// ── simulation_responses ─────────────────────────────────────

export interface SimulationResponse {
  id: string
  session_id: string
  user_id: string
  task_number: number
  response_text: string | null
  file_urls: string[] | null
  link_urls: string[] | null
  saved_at: string
}

export interface SimulationResponseInsert {
  session_id: string
  user_id: string
  task_number: number
  response_text?: string | null
  file_urls?: string[] | null
  link_urls?: string[] | null
}

export interface SimulationResponseUpdate {
  response_text?: string | null
  file_urls?: string[] | null
  link_urls?: string[] | null
}

// ── evaluation_results ───────────────────────────────────────

export type VerdictBand = 'Distinction' | 'Merit' | 'Pass' | 'Borderline' | 'Did Not Pass'

export interface EvaluationTaskScore {
  taskId: number
  title: string
  score: number
  maxScore: number
  summary: string
}

export interface EvaluationCriterionScore {
  taskId: number
  name: string
  score: 1 | 2 | 3
  level: 'Weak' | 'Competent' | 'Strong'
  feedback: string
}

export interface EvaluationResult {
  id: string
  session_id: string
  user_id: string
  simulation_slug: string
  verdict_band: VerdictBand
  overall_score: number | null
  task_scores: EvaluationTaskScore[]
  criteria_scores: EvaluationCriterionScore[]
  feedback_text: string | null
  raw_evaluation: Record<string, unknown>
  evaluated_at: string
}

export interface EvaluationResultInsert {
  session_id: string
  user_id: string
  simulation_slug: string
  verdict_band: VerdictBand
  overall_score?: number | null
  task_scores: EvaluationTaskScore[]
  criteria_scores: EvaluationCriterionScore[]
  feedback_text?: string | null
  raw_evaluation: Record<string, unknown>
}

// ── coaches ──────────────────────────────────────────────────

export interface Coach {
  id: string
  user_id: string
  organisation_name: string | null
  max_seats: number
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface CoachInsert {
  user_id: string
  organisation_name?: string | null
  max_seats?: number
  stripe_customer_id?: string | null
}

export interface CoachUpdate {
  organisation_name?: string | null
  max_seats?: number
  stripe_customer_id?: string | null
}

// ── coach_candidates ─────────────────────────────────────────

export type InviteStatus = 'pending' | 'accepted' | 'revoked'

export interface CoachCandidate {
  id: string
  coach_id: string
  candidate_user_id: string | null
  invite_email: string
  invite_token: string
  invite_status: InviteStatus
  invited_at: string
  accepted_at: string | null
}

export interface CoachCandidateInsert {
  coach_id: string
  candidate_user_id?: string | null
  invite_email: string
  invite_token: string
  invite_status?: InviteStatus
  accepted_at?: string | null
}

export interface CoachCandidateUpdate {
  candidate_user_id?: string | null
  invite_status?: InviteStatus
  accepted_at?: string | null
}

// ── simulation_assignments ───────────────────────────────────

export interface SimulationAssignment {
  id: string
  coach_id: string
  candidate_user_id: string
  simulation_id: string
  assigned_at: string
}

export interface SimulationAssignmentInsert {
  coach_id: string
  candidate_user_id: string
  simulation_id: string
}

// ── coach_notes ──────────────────────────────────────────────

export interface CoachNote {
  id: string
  coach_id: string
  candidate_user_id: string
  simulation_id: string
  note_content: string | null
  shared_with_candidate: boolean
  created_at: string
  updated_at: string
}

export interface CoachNoteInsert {
  coach_id: string
  candidate_user_id: string
  simulation_id: string
  note_content?: string | null
  shared_with_candidate?: boolean
}

export interface CoachNoteUpdate {
  note_content?: string | null
  shared_with_candidate?: boolean
}

// ── credential_issuances ─────────────────────────────────────

export type CredentialStatus = 'pending' | 'issued' | 'failed'

export interface CredentialIssuance {
  id: string
  candidate_user_id: string
  coach_id: string | null
  simulation_id: string
  certifier_credential_id: string | null
  certifier_credential_url: string | null
  issued_at: string
  status: CredentialStatus
}

export interface CredentialIssuanceInsert {
  candidate_user_id: string
  coach_id?: string | null
  simulation_id: string
  certifier_credential_id?: string | null
  certifier_credential_url?: string | null
  status?: CredentialStatus
}

export interface CredentialIssuanceUpdate {
  certifier_credential_id?: string | null
  certifier_credential_url?: string | null
  status?: CredentialStatus
}

// ── Database convenience type (for createClient<Database>()) ──

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      simulation_sessions: {
        Row: SimulationSession
        Insert: SimulationSessionInsert
        Update: SimulationSessionUpdate
      }
      simulation_responses: {
        Row: SimulationResponse
        Insert: SimulationResponseInsert
        Update: SimulationResponseUpdate
      }
      evaluation_results: {
        Row: EvaluationResult
        Insert: EvaluationResultInsert
        Update: Partial<EvaluationResultInsert>
      }
      coaches: {
        Row: Coach
        Insert: CoachInsert
        Update: CoachUpdate
      }
      coach_candidates: {
        Row: CoachCandidate
        Insert: CoachCandidateInsert
        Update: CoachCandidateUpdate
      }
      simulation_assignments: {
        Row: SimulationAssignment
        Insert: SimulationAssignmentInsert
        Update: Partial<SimulationAssignmentInsert>
      }
      coach_notes: {
        Row: CoachNote
        Insert: CoachNoteInsert
        Update: CoachNoteUpdate
      }
      credential_issuances: {
        Row: CredentialIssuance
        Insert: CredentialIssuanceInsert
        Update: CredentialIssuanceUpdate
      }
    }
  }
}

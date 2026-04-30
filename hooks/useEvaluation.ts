"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Evaluation result types (frontend shape — matches Claude API output) ──

export interface EvaluationCriterion {
  name: string;
  score: 1 | 2 | 3;
  level: "Weak" | "Competent" | "Strong";
  feedback: string;
}

export interface EvaluationTask {
  taskId: number;
  title: string;
  score: number;
  maxScore: number;
  criteria: EvaluationCriterion[];
  summary: string;
}

export interface EvaluationResult {
  overallScore: number;
  maxScore: number;
  percentage: number;
  verdict: "Distinction" | "Pass with Merit" | "Pass" | "Borderline" | "Did Not Pass";
  verdictDescription: string;
  credentialIssued: boolean;
  tasks: EvaluationTask[];
}

type EvaluationApiResponse = EvaluationResult & {
  warnings?: Array<{ message: string; details?: string }>;
};

// ── localStorage helpers (unauthenticated users) ──────────────────

export function storageKey(simulationId: string): string {
  return `evaluation-result-${simulationId}`;
}

export function loadEvaluationResult(simulationId: string): EvaluationResult | null {
  try {
    const raw = localStorage.getItem(storageKey(simulationId));
    return raw ? (JSON.parse(raw) as EvaluationResult) : null;
  } catch {
    return null;
  }
}

// ── Supabase loader (authenticated users) ────────────────────────
// The API route writes the full Claude response as raw_evaluation, so we
// read it back directly — no reshape needed.

export async function loadEvaluationResultFromSupabase(
  sessionId: string
): Promise<EvaluationResult | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("evaluation_results")
      .select("raw_evaluation")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!data?.raw_evaluation) return null;
    return data.raw_evaluation as EvaluationResult;
  } catch {
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────

interface TaskInput {
  taskId: number;
  title: string;
  response: string;
}

export function useEvaluation() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * POSTs task responses to /api/evaluate.
   *
   * For authenticated users (sessionId + userId provided):
   *   - sends session_id, user_id, simulation_slug to the API
   *   - API route writes the result to Supabase
   *   - redirect URL includes ?session_id= so the results page loads from Supabase
   *
   * For unauthenticated users (sessionId / userId absent):
   *   - persists the result to localStorage (existing behaviour)
   *   - redirect URL has no session_id; results page polls localStorage
   */
  async function submitForEvaluation(
    simulationId: string,
    responses: TaskInput[],
    sessionId?: string | null,
    userId?: string | null
  ): Promise<string | null> {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses,
          session_id: sessionId ?? null,
          simulation_slug: simulationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Request failed (${res.status})`
        );
      }

      const result: EvaluationApiResponse = await res.json();

      // Unauthenticated path: persist to localStorage so the results page can read it
      if (!sessionId || !userId) {
        localStorage.setItem(storageKey(simulationId), JSON.stringify(result));
      }

      const redirectBase = `/simulate/${simulationId}/results`;
      const warnings = result.warnings ?? [];
      const warningParam = warnings.length > 0
        ? `&warning=${encodeURIComponent(warnings.map((warning) => warning.message).join(" "))}`
        : "";

      return sessionId
        ? `${redirectBase}?session_id=${encodeURIComponent(sessionId)}${warningParam}`
        : redirectBase;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed. Please try again.");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submitForEvaluation, isSubmitting, error };
}

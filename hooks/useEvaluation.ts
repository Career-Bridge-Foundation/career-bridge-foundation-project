"use client";

import { useState } from "react";

// ── Evaluation result types ───────────────────────────────────────

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

// ── Storage helpers ───────────────────────────────────────────────

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
   * POSTs formatted task responses to /api/evaluate, persists the result
   * to localStorage, and returns the redirect URL for the results page.
   * Returns null and sets error state if the request fails.
   */
  async function submitForEvaluation(
    simulationId: string,
    responses: TaskInput[]
  ): Promise<string | null> {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Request failed (${res.status})`
        );
      }

      const result: EvaluationResult = await res.json();
      localStorage.setItem(storageKey(simulationId), JSON.stringify(result));

      return `/simulations/product-management/${simulationId}/results`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed. Please try again.");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submitForEvaluation, isSubmitting, error };
}

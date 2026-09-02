"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Prompt, StepResponse } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
  uploadSimulationFile,
  validateSimulationFile,
  UploadValidationError,
} from "@/lib/storage/uploadSimulationFile";

export interface PracticeFeedback {
  strength: string;
  gaps: [string, string];
}

interface UsePracticeRunReturn {
  runId: string | null;
  runError: string | null;
  currentStep: number;
  responses: Record<number, StepResponse>;
  uploadingTaskId: number | null;
  fileUploadError: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  feedback: PracticeFeedback | null;
  updateResponse: (patch: Partial<StepResponse>) => void;
  handleFileSelect: (file: File, taskId: number) => Promise<void>;
  goNext: () => void;
  goPrev: () => void;
  submit: (prompts: Prompt[]) => Promise<void>;
}

/**
 * Practice Trial run state. Deliberately lighter than useSimulation.ts:
 * responses live only in React state and are sent in one shot to
 * POST /api/practice/runs/:id/submit — there is no per-keystroke autosave
 * table for practice (Spec 14's practice_runs has no response-storage
 * columns), matching the spec's "shortened scenario depth" / lower-stakes
 * intent for this free surface.
 */
export function usePracticeRun(simulationUuid: string | null): UsePracticeRunReturn {
  const [runId, setRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<number, StepResponse>>({});
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);

  const userIdRef = useRef<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const responsesRef = useRef<Record<number, StepResponse>>({});

  useEffect(() => { runIdRef.current = runId; }, [runId]);
  useEffect(() => { responsesRef.current = responses; }, [responses]);

  // ── Start a run as soon as the simulation UUID is known ─────────
  useEffect(() => {
    if (!simulationUuid) return;
    let cancelled = false;

    async function start() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      userIdRef.current = user.id;

      try {
        const res = await fetch("/api/practice/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simulation_id: simulationUuid }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
        }
        const data: { run_id: string } = await res.json();
        if (!cancelled) setRunId(data.run_id);
      } catch (err) {
        if (!cancelled) setRunError(err instanceof Error ? err.message : "Could not start practice run.");
      }
    }

    start();
    return () => { cancelled = true; };
  }, [simulationUuid]);

  const updateResponse = useCallback((patch: Partial<StepResponse>) => {
    setResponses((prev) => ({
      ...prev,
      [currentStep]: { ...prev[currentStep], ...patch },
    }));
  }, [currentStep]);

  const handleFileSelect = useCallback(async (file: File, taskId: number) => {
    setFileUploadError(null);
    try {
      validateSimulationFile(file);
    } catch (err) {
      setFileUploadError(err instanceof UploadValidationError ? err.message : "Invalid file.");
      return;
    }

    const uid = userIdRef.current;
    const rid = runIdRef.current;
    const stepIndex = taskId - 1;

    setResponses((prev) => ({
      ...prev,
      [stepIndex]: { ...prev[stepIndex], file: { name: file.name, size: file.size } },
    }));

    if (!uid || !rid) return;

    setUploadingTaskId(taskId);
    try {
      const filePath = await uploadSimulationFile(file, uid, rid, taskId);
      setResponses((prev) => ({
        ...prev,
        [stepIndex]: { ...prev[stepIndex], file: { name: file.name, size: file.size, filePath } },
      }));
    } catch (err) {
      setFileUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setResponses((prev) => ({ ...prev, [stepIndex]: { ...prev[stepIndex], file: null } }));
    } finally {
      setUploadingTaskId(null);
    }
  }, []);

  function goNext() {
    setCurrentStep((s) => s + 1);
  }
  function goPrev() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function buildResponseText(resp: StepResponse | undefined): string {
    if (!resp) return "";
    if (resp.text) return resp.text;
    if (resp.file?.name) return `[Uploaded document: ${resp.file.name}]`;
    if (resp.rationale) return resp.rationale;
    return "";
  }

  const submit = useCallback(async (prompts: Prompt[]) => {
    const rid = runIdRef.current;
    if (!rid) {
      setSubmitError("Practice run has not started yet. Please try again.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = prompts.map((p, i) => ({
        taskId: p.id,
        title: p.title,
        response: buildResponseText(responsesRef.current[i]),
      }));

      const res = await fetch(`/api/practice/runs/${rid}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: payload }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
      }

      const data: { feedback: PracticeFeedback } = await res.json();
      setFeedback(data.feedback);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    runId,
    runError,
    currentStep,
    responses,
    uploadingTaskId,
    fileUploadError,
    isSubmitting,
    submitError,
    feedback,
    updateResponse,
    handleFileSelect,
    goNext,
    goPrev,
    submit,
  };
}

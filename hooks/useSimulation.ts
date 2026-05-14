"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StepResponse } from "@/types";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "sim-product-strategy"; // legacy key — kept for unauthenticated users

interface UseSimulationReturn {
  loading: boolean;
  prompts: Prompt[];
  timeRemaining: number[];
  context: SimulationContext;
  currentStep: number;
  responses: Record<number, StepResponse>;
  saveStatus: "idle" | "saving" | "saved";
  submitStatus: "idle" | "validating" | "submitting" | "success" | "error";
  submitError: string | null;
  lastSaved: Date | null;
  uploadedFiles: File[];
  attachedUrls: string[];
  transcriptOpen: boolean;
  briefExpanded: boolean;
  muted: boolean;
  attemptId: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  sessionId: string | null;
  userId: string | null;
  setTranscriptOpen: (open: boolean) => void;
  setBriefExpanded: (expanded: boolean) => void;
  setMuted: (muted: boolean) => void;
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setAttachedUrls: React.Dispatch<React.SetStateAction<string[]>>;
  updateResponse: (patch: Partial<StepResponse>) => void;
  goNext: () => void;
  goPrev: () => void;
  saveToStorage: () => void;
  markSubmitted: () => Promise<void>;
  lastSavedText: () => string;
}

export function useSimulation(
  simulationSlug: string,
  discipline = "Product Management"
): UseSimulationReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<number, StepResponse>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "validating" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable refs so async callbacks always see latest values without stale closures
  const userIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const responsesRef = useRef<Record<number, StepResponse>>({});
  const currentStepRef = useRef(0);
  const simulationSlugRef = useRef(simulationSlug);
  const disciplineRef = useRef(discipline);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents the DB-load from triggering an unnecessary auto-save on mount
  const userEditedRef = useRef(false);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { simulationSlugRef.current = simulationSlug; }, [simulationSlug]);
  useEffect(() => { disciplineRef.current = discipline; }, [discipline]);

  // ── INIT: load state on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        // Unauthenticated: restore from localStorage
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const data = JSON.parse(saved);
            if (typeof data.currentStep === "number") setCurrentStep(data.currentStep);
            if (data.responses) setResponses(data.responses);
            if (data.attachedUrls) setAttachedUrls(data.attachedUrls);
          }
        } catch { /* ignore */ }
        return;
      }

      // Set userId via both state and ref so the ref is available immediately
      userIdRef.current = user.id;
      if (!cancelled) setUserId(user.id);

      // Find an existing in_progress session
      const { data: session } = await supabase
        .from("simulation_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_slug", simulationSlug)
        .eq("status", "in_progress")
        .maybeSingle();

      if (cancelled) return;

      if (session) {
        sessionIdRef.current = session.id;
        if (!cancelled) setSessionId(session.id);

        const { data: dbResponses } = await supabase
          .from("simulation_responses")
          .select("task_number, response_text, link_urls")
          .eq("session_id", session.id)
          .order("task_number");

        if (cancelled) return;

        if (dbResponses?.length) {
          const loaded: Record<number, StepResponse> = {};
          for (const r of dbResponses) {
            // task_number is 1-indexed; currentStep is 0-indexed
            loaded[r.task_number - 1] = {
              text: r.response_text ?? undefined,
              url: r.link_urls?.[0] ?? undefined,
            };
          }
          responsesRef.current = loaded;
          setResponses(loaded);
        }
      }
      // No existing session — it will be created on first save
    }

    init().catch(console.error);
    return () => { cancelled = true; };
  }, [simulationSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPABASE SAVE ─────────────────────────────────────────────
  const saveToSupabase = useCallback(async () => {
    const uid = userIdRef.current;
    const slug = simulationSlugRef.current;
    const disc = disciplineRef.current;
    // Capture at call time — refs may change before async ops resolve
    const step = currentStepRef.current;
    const allResponses = responsesRef.current;

    if (!uid) return;

    setSaveStatus("saving");
    const supabase = createClient();

    try {
      let sid = sessionIdRef.current;

      // Create session on first save if it doesn't exist yet
      if (!sid) {
        const { data: newSession, error } = await supabase
          .from("simulation_sessions")
          .upsert(
            {
              user_id: uid,
              simulation_slug: slug,
              discipline: disc,
              status: "in_progress",
            },
            { onConflict: "user_id,simulation_slug" }
          )
          .select("id")
          .single();

        if (error) throw error;
        sid = newSession.id;
        sessionIdRef.current = sid;
        setSessionId(sid);
      }

      // Upsert the current step's response
      const stepResp = allResponses[step];
      if (stepResp && (stepResp.text || stepResp.url)) {
        const taskNumber = step + 1;
        const payload = {
          response_text: stepResp.text ?? null,
          link_urls: stepResp.url ? [stepResp.url] : null,
        };

        await supabase
          .from("simulation_responses")
          .upsert(
            {
              ...payload,
              session_id: sid,
              user_id: uid,
              task_number: taskNumber,
            },
            { onConflict: "session_id,task_number" }
          );
      }

      setLastSaved(new Date());
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
      return;
    }

    setTimeout(() => setSaveStatus("idle"), 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MARK SUBMITTED: saves all responses then flips session status ──
  const markSubmitted = useCallback(async () => {
    const uid = userIdRef.current;
    const allResponses = responsesRef.current;

    if (!uid) {
      // Unauthenticated fallback — write directly without delay
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            currentStep: currentStepRef.current,
            responses: allResponses,
            attachedUrls: [],
          })
        );
      } catch { /* ignore */ }
      return;
    }

    const supabase = createClient();
    let sid = sessionIdRef.current;

    if (!sid) {
      const { data: newSession } = await supabase
        .from("simulation_sessions")
        .upsert(
          {
            user_id: uid,
            simulation_slug: simulationSlugRef.current,
            discipline: disciplineRef.current,
            status: "in_progress",
          },
          { onConflict: "user_id,simulation_slug" }
        )
        .select("id")
        .single();

      if (!newSession) return;
      sid = newSession.id;
      sessionIdRef.current = sid;
      setSessionId(sid);
    }

    // Persist all responses with content
    for (const [stepStr, stepResp] of Object.entries(allResponses)) {
      if (!stepResp?.text && !stepResp?.url) continue;
      const taskNumber = parseInt(stepStr) + 1;
      const payload = {
        response_text: stepResp.text ?? null,
        link_urls: stepResp.url ? [stepResp.url] : null,
      };

      await supabase
        .from("simulation_responses")
        .upsert(
          {
            ...payload,
            session_id: sid,
            user_id: uid,
            task_number: taskNumber,
          },
          { onConflict: "session_id,task_number" }
        );
    }

    await supabase
      .from("simulation_sessions")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", sid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── LOCALSTORAGE SAVE (unauthenticated fallback) ───────────────
  const saveToLocalStorage = useCallback(() => {
    setSaveStatus("saving");
    setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            currentStep: currentStepRef.current,
            responses: responsesRef.current,
            attachedUrls: [],
          })
        );
        setLastSaved(new Date());
        setSaveStatus("saved");
      } catch { /* ignore */ }
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
  }, []);

  // ── PUBLIC saveToStorage ───────────────────────────────────────
  const saveToStorage = useCallback(() => {
    if (userIdRef.current) {
      void saveToSupabase();
    } else {
      saveToLocalStorage();
    }
  }, [saveToSupabase, saveToLocalStorage]);

  // ── DEBOUNCED AUTO-SAVE (authenticated, 500ms after typing stops) ──
  useEffect(() => {
    // Skip saves triggered by the initial DB load
    if (!userEditedRef.current || !userIdRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveToSupabase();
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [responses, saveToSupabase]);

  // ── 30-SECOND AUTO-SAVE INTERVAL (unauthenticated only) ───────
  useEffect(() => {
    if (userIdRef.current) return;
    const interval = setInterval(saveToLocalStorage, 30000);
    return () => clearInterval(interval);
  }, [saveToLocalStorage]);

  // ── RESPONSE MANAGEMENT ────────────────────────────────────────
  const updateResponse = useCallback(
    (patch: Partial<StepResponse>) => {
      userEditedRef.current = true; // mark as user-initiated change
      setResponses((prev) => ({
        ...prev,
        [currentStep]: { ...prev[currentStep], ...patch },
      }));
    },
    [currentStep]
  );

  function goNext() {
    // Cancel pending debounce and save current step immediately
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveToStorage();
    if (currentStep < prompts.length - 1) setCurrentStep((s) => s + 1);
  }

  function goPrev() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  function lastSavedText(): string {
    if (!lastSaved) return "Not yet saved";
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 120) return "1 min ago";
    return `${Math.floor(diff / 60)} mins ago`;
  }

  async function submitAttempt(): Promise<boolean> {
    // Validate all prompts have responses first
    setSubmitStatus("validating");
    const missingPrompts: number[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const response = responses[i];
      const hasText = response?.text && response.text.trim();
      const hasFile = response?.file?.name;
      const hasUrl = response?.url && response.url.trim();
      
      if (!hasText && !hasFile && !hasUrl) {
        missingPrompts.push(i);
      }
    }

    if (missingPrompts.length > 0) {
      setSubmitError(
        `Please complete all ${missingPrompts.length} prompt${missingPrompts.length > 1 ? "s" : ""} before submitting.`
      );
      setSubmitStatus("error");
      return false;
    }

    // If no attempt ID, create one now
    let finalAttemptId: string = attemptId || "";
    if (!finalAttemptId) {
      const candidateStr = localStorage.getItem("cb_candidate");
      if (!candidateStr) {
        setSubmitError("Candidate information not found. Please refresh and start again.");
        setSubmitStatus("error");
        return false;
      }

      try {
        const candidate = JSON.parse(candidateStr);
        const response = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simulation_id: simulationId,
            candidate_name: candidate.name,
            candidate_email: candidate.email,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Attempt creation failed:", error);
          setSubmitError("Failed to initialize attempt. Please refresh and try again.");
          setSubmitStatus("error");
          return false;
        }

        const data = await response.json();
        if (!data.attempt_id) {
          setSubmitError("Failed to get attempt ID. Please refresh and try again.");
          setSubmitStatus("error");
          return false;
        }

        finalAttemptId = data.attempt_id;
        if (simulationId) {
          const storageKey = `attempt_${simulationId}`;
          sessionStorage.setItem(storageKey, finalAttemptId);
        }
        setAttemptId(finalAttemptId);
      } catch (error) {
        console.error("Error creating attempt:", error);
        setSubmitError("Failed to initialize attempt. Please refresh and try again.");
        setSubmitStatus("error");
        return false;
      }
    }

    // Submit to API
    setSubmitStatus("submitting");
    try {
      const response = await fetch(`/api/attempts/${finalAttemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });

      if (!response.ok) {
        const error = await response.json();
        setSubmitError(error.error || "Failed to submit simulation");
        setSubmitStatus("error");
        return false;
      }

      const data = await response.json();
      setSubmitStatus("success");
      
      // Clear session storage
      localStorage.removeItem("cb_candidate");

      return true;
    } catch (error) {
      console.error("Submission error:", error);
      setSubmitError("An unexpected error occurred");
      setSubmitStatus("error");
      return false;
    }
  }

  return {
    loading,
    prompts,
    timeRemaining,
    context,
    currentStep,
    responses,
    saveStatus,
    submitStatus,
    submitError,
    lastSaved,
    uploadedFiles,
    attachedUrls,
    transcriptOpen,
    briefExpanded,
    muted,
    attemptId,
    fileInputRef,
    sessionId,
    userId,
    setTranscriptOpen,
    setBriefExpanded,
    setMuted,
    setUploadedFiles,
    setAttachedUrls,
    updateResponse,
    goNext,
    goPrev,
    saveToStorage,
    markSubmitted,
    lastSavedText,
  };
}

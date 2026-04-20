"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Prompt, StepResponse } from "@/types";
import type { Simulation, SimulationPrompt } from "@/types/simulation";
import { getSimulation } from "@/lib/requests";

const STORAGE_KEY = "sim-product-strategy";

type SimulationContext = {
  title: string;
  company: string;
  industry: string;
  role: string;
  briefShort: string;
  briefFull: string;
  videoTranscript: string;
  videoPresenterName: string;
  videoPresenterTitle: string;
};

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
  setTranscriptOpen: (open: boolean) => void; 
  setBriefExpanded: (expanded: boolean) => void;
  setMuted: (muted: boolean) => void;
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  setAttachedUrls: React.Dispatch<React.SetStateAction<string[]>>;
  updateResponse: (patch: Partial<StepResponse>) => void;
  goNext: () => void;
  goPrev: () => void;
  saveToStorage: () => void;
  submitAttempt: () => Promise<boolean>;
  lastSavedText: () => string;
}

const EMPTY_CONTEXT: SimulationContext = {
  title: "",
  company: "",
  industry: "",
  role: "",
  briefShort: "",
  briefFull: "",
  videoTranscript: "",
  videoPresenterName: "",
  videoPresenterTitle: "",
};

function parseEstimatedMinutes(estimatedMinutes: string, promptCount: number): number {
  const numbers = estimatedMinutes.match(/\d+/g)?.map((n) => Number.parseInt(n, 10)) ?? [];
  if (numbers.length === 0) return Math.max(promptCount * 10, 10);
  if (numbers.length === 1) return Math.max(numbers[0], 10);
  return Math.max(Math.round((numbers[0] + numbers[1]) / 2), 10);
}

function buildTimeRemaining(totalMinutes: number, promptCount: number): number[] {
  if (promptCount <= 0) return [];

  const perStep = Math.max(Math.ceil(totalMinutes / promptCount), 1);
  return Array.from({ length: promptCount }, (_, index) => {
    return Math.max(totalMinutes - (index * perStep), 1);
  });
}

function buildPromptGuidance(prompt: SimulationPrompt): string[] {
  const guidance: string[] = [];

  if (prompt.wordMin > 0) {
    if (prompt.wordMax > prompt.wordMin) {
      guidance.push(`Target ${prompt.wordMin} to ${prompt.wordMax} words.`);
    } else {
      guidance.push(`Write at least ${prompt.wordMin} words.`);
    }
  }

  if (prompt.submissionType === "typed") {
    guidance.push("Respond in clear written form.");
  } else if (prompt.submissionType === "either") {
    guidance.push("You may submit a typed response or upload a document.");
  } else if (prompt.submissionType === "url") {
    guidance.push("Provide a public URL and explain your rationale.");
  }

  return guidance.length > 0
    ? guidance
    : ["Answer with a clear structure and practical reasoning."];
}

function toBriefShort(fullBrief: string): string {
  const trimmed = fullBrief.trim();
  if (trimmed.length <= 260) return trimmed;
  return `${trimmed.slice(0, 257).trimEnd()}...`;
}

function mapSimulationPromptToPrompt(prompt: SimulationPrompt, index: number): Prompt {
  const promptType = prompt.submissionType === "typed" || prompt.submissionType === "either" || prompt.submissionType === "url"
    ? prompt.submissionType
    : "typed";

  return {
    id: index + 1,
    type: promptType,
    title: prompt.title,
    question: prompt.body,
    guidance: buildPromptGuidance(prompt),
    minWords: prompt.wordMin,
  };
}

function mapSimulationToContext(simulation: Simulation): SimulationContext {
  const briefFull = simulation.scenarioBriefFull ?? simulation.scenarioBrief ?? "";

  return {
    title: simulation.title,
    company: simulation.company,
    industry: simulation.industry,
    role: simulation.candidateRole,
    briefShort: toBriefShort(briefFull),
    briefFull,
    videoTranscript: simulation.videoTranscript ?? "",
    videoPresenterName: simulation.videoPresenterName ?? "",
    videoPresenterTitle: simulation.videoPresenterTitle ?? "",
  };
}

export function useSimulation(simulationId?: string): UseSimulationReturn {
  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number[]>([]);
  const [context, setContext] = useState<SimulationContext>(EMPTY_CONTEXT);
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
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSimulation() {
      setLoading(true);
      if (!simulationId) {
        if (isMounted) {
          setPrompts([]);
          setTimeRemaining([]);
          setContext(EMPTY_CONTEXT);
          setLoading(false);
        }
        return;
      }

      const simulation = await getSimulation(simulationId);
      if (!simulation || !Array.isArray(simulation.prompts) || simulation.prompts.length === 0) {
        if (isMounted) {
          setPrompts([]);
          setTimeRemaining([]);
          setContext(EMPTY_CONTEXT);
          setLoading(false);
        }
        return;
      }

      const mappedPrompts = simulation.prompts.map(mapSimulationPromptToPrompt);
      const estimatedTotal = parseEstimatedMinutes(simulation.estimatedMinutes, mappedPrompts.length);
      const mappedTimeRemaining = buildTimeRemaining(estimatedTotal, mappedPrompts.length);

      if (isMounted) {
        setPrompts(mappedPrompts);
        setTimeRemaining(mappedTimeRemaining);
        setContext(mapSimulationToContext(simulation));
        setCurrentStep((prev) => Math.min(prev, mappedPrompts.length - 1));
        setLoading(false);
      }
    }

    void loadSimulation();

    return () => {
      isMounted = false;
    };
  }, [simulationId]);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.currentStep === "number") setCurrentStep(data.currentStep);
        if (data.responses) setResponses(data.responses);
        if (data.attachedUrls) setAttachedUrls(data.attachedUrls);
      }
    } catch { /* ignore */ }
  }, []);

  const saveToStorage = useCallback(() => {
    setSaveStatus("saving");
    setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ currentStep, responses, attachedUrls })
        );
        setLastSaved(new Date());
        setSaveStatus("saved");
      } catch { /* ignore */ }
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 500);
  }, [currentStep, responses, attachedUrls]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(saveToStorage, 30000);
    return () => clearInterval(interval);
  }, [saveToStorage]);

  const updateResponse = useCallback(
    (patch: Partial<StepResponse>) => {
      setResponses((prev) => ({
        ...prev,
        [currentStep]: { ...prev[currentStep], ...patch },
      }));
    },
    [currentStep]
  );

  function goNext() {
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
    setTranscriptOpen,
    setBriefExpanded,
    setMuted,
    setUploadedFiles,
    setAttachedUrls,
    updateResponse,
    goNext,
    goPrev,
    saveToStorage,
    submitAttempt,
    lastSavedText,
  };
}

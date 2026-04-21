"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StepResponse } from "@/types";

const STORAGE_KEY = "sim-product-strategy";

interface UseSimulationReturn {
  currentStep: number;
  responses: Record<number, StepResponse>;
  saveStatus: "idle" | "saving" | "saved";
  lastSaved: Date | null;
  uploadedFiles: File[];
  attachedUrls: string[];
  transcriptOpen: boolean;
  briefExpanded: boolean;
  muted: boolean;
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
  lastSavedText: () => string;
}

export function useSimulation(): UseSimulationReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<number, StepResponse>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [muted, setMuted] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (currentStep < 4) setCurrentStep((s) => s + 1);
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

  return {
    currentStep,
    responses,
    saveStatus,
    lastSaved,
    uploadedFiles,
    attachedUrls,
    transcriptOpen,
    briefExpanded,
    muted,
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
    lastSavedText,
  };
}

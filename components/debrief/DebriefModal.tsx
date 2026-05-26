"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DebriefSummary, DebriefQuestion } from "@/types/database";

// ── Constants ────────────────────────────────────────────────

const NAVY = "#003359";
const TEAL = "#4DC5D2";
const BORDER = "#D5DCE8";

// ── Types ─────────────────────────────────────────────────────

type FlowState =
  | "loading"
  | "pre_call"
  | "call_connecting"
  | "in_call"
  | "processing"
  | "reviewing"
  | "approving"
  | "approved"
  | "error";

interface DebriefRecord {
  id: string;
  status: string;
  questions_generated: DebriefQuestion[] | null;
  structured_summary: DebriefSummary | null;
  candidate_edited_summary: DebriefSummary | null;
  raw_transcript: string | null;
}

interface DebriefModalProps {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Sub-views ─────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14 px-8">
      <div
        className="w-7 h-7 rounded-full border-2"
        style={{
          borderColor: `${TEAL}40`,
          borderTopColor: TEAL,
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p className="text-sm" style={{ color: "#888" }}>
        Preparing your debrief…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function PreCallView({
  debrief,
  onBegin,
  onClose,
}: {
  debrief: DebriefRecord;
  onBegin: () => void;
  onClose: () => void;
}) {
  const questions = debrief.questions_generated ?? [];

  return (
    <div className="p-7 flex flex-col gap-6">
      {/* Header */}
      <div>
        <p
          className="text-xs font-semibold uppercase mb-2"
          style={{ color: TEAL, letterSpacing: "0.16em" }}
        >
          Voice Debrief
        </p>
        <h3 className="text-xl font-bold" style={{ color: NAVY }}>
          Reflect on Your Work
        </h3>
        <p className="text-sm mt-2" style={{ color: "#666", lineHeight: 1.75 }}>
          A short 5–8 minute voice call with an AI coach. Your answers are
          transcribed and turned into a written reflection for your portfolio.
        </p>
      </div>

      {/* Questions preview */}
      {questions.length > 0 && (
        <div
          className="p-4 flex flex-col gap-3"
          style={{ backgroundColor: "#F8FAFB", border: `1px solid ${BORDER}` }}
        >
          <p
            className="text-xs font-semibold uppercase"
            style={{ color: "#999", letterSpacing: "0.12em" }}
          >
            You&apos;ll be asked
          </p>
          {questions.map((q, i) => (
            <div key={i} className="flex gap-3">
              <span
                className="text-xs font-bold shrink-0 mt-0.5"
                style={{ color: TEAL }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-sm" style={{ color: NAVY, lineHeight: 1.7 }}>
                {q.question}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="flex flex-col gap-2">
        {[
          "Allow microphone access when prompted",
          "Speak naturally — there are no wrong answers",
          "You can review and edit the summary before publishing",
        ].map((tip, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={TEAL}
              strokeWidth="2.5"
              strokeLinecap="round"
              className="shrink-0 mt-0.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p className="text-sm" style={{ color: "#555" }}>
              {tip}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBegin}
          className="flex-1 text-sm font-semibold py-3 text-white text-center"
          style={{ backgroundColor: TEAL, cursor: "pointer" }}
        >
          Begin Voice Call →
        </button>
        <button
          onClick={onClose}
          className="text-sm font-medium px-5 py-3"
          style={{ border: `1px solid ${BORDER}`, color: "#888", cursor: "pointer", background: "white" }}
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

function CallConnectingView() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14 px-8">
      <div
        className="w-7 h-7 rounded-full border-2"
        style={{
          borderColor: `${TEAL}40`,
          borderTopColor: TEAL,
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p className="text-sm font-medium" style={{ color: NAVY }}>
        Connecting your call…
      </p>
      <p className="text-xs" style={{ color: "#aaa" }}>
        Please allow microphone access if prompted
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function InCallView({
  debrief,
  isAiSpeaking,
  callDuration,
  onEndCall,
}: {
  debrief: DebriefRecord;
  isAiSpeaking: boolean;
  callDuration: number;
  onEndCall: () => void;
}) {
  const questions = debrief.questions_generated ?? [];
  const [showQuestions, setShowQuestions] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-7">
      {/* Live indicator + timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: "#EF4444",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          <span className="text-xs font-semibold uppercase" style={{ color: "#EF4444", letterSpacing: "0.12em" }}>
            Live
          </span>
        </div>
        <span className="text-sm font-mono" style={{ color: "#999" }}>
          {formatDuration(callDuration)}
        </span>
      </div>

      {/* AI voice visualizer */}
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
          @keyframes ai-pulse { 0%, 100% { transform: scale(1); opacity: 0.9 } 50% { transform: scale(1.18); opacity: 1 } }
          @keyframes ai-ring { 0%, 100% { transform: scale(1); opacity: 0.3 } 50% { transform: scale(1.35); opacity: 0 } }
        `}</style>
        <div className="relative flex items-center justify-center">
          {/* Outer ring (AI speaking animation) */}
          {isAiSpeaking && (
            <div
              className="absolute rounded-full"
              style={{
                width: "90px",
                height: "90px",
                border: `2px solid ${TEAL}`,
                animation: "ai-ring 1.2s ease-in-out infinite",
              }}
            />
          )}
          {/* Main circle */}
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: "72px",
              height: "72px",
              backgroundColor: isAiSpeaking ? TEAL : "#E5F8FA",
              animation: isAiSpeaking ? "ai-pulse 1.2s ease-in-out infinite" : "none",
              transition: "background-color 0.4s ease",
            }}
          >
            {/* Mic / wave icon */}
            {isAiSpeaking ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </div>
        </div>
        <p className="text-sm text-center" style={{ color: "#888", minHeight: "20px" }}>
          {isAiSpeaking ? "AI coach is speaking…" : "Your turn — speak naturally"}
        </p>
      </div>

      {/* Questions toggle */}
      {questions.length > 0 && (
        <div>
          <button
            onClick={() => setShowQuestions((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium w-full"
            style={{ color: "#888", cursor: "pointer", background: "none", border: "none", padding: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points={showQuestions ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
            </svg>
            {showQuestions ? "Hide questions" : "Show questions"}
          </button>
          {showQuestions && (
            <div className="mt-3 flex flex-col gap-2">
              {questions.map((q, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="text-xs font-bold shrink-0" style={{ color: TEAL }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-xs" style={{ color: "#666", lineHeight: 1.6 }}>
                    {q.question}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* End call */}
      <button
        onClick={onEndCall}
        className="w-full text-sm font-semibold py-3 text-white"
        style={{ backgroundColor: "#EF4444", cursor: "pointer" }}
      >
        End Call
      </button>
    </div>
  );
}

function ProcessingView() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14 px-8 text-center">
      <style>{`
        @keyframes cb-bar {
          0%   { left: -45%; width: 45%; }
          100% { left: 110%; width: 45%; }
        }
      `}</style>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          height: "4px",
          width: "200px",
          backgroundColor: "#E5E7EB",
          borderRadius: "9999px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            backgroundColor: TEAL,
            borderRadius: "9999px",
            animation: "cb-bar 1.6s ease-in-out infinite",
          }}
        />
      </div>
      <p className="text-sm font-medium" style={{ color: NAVY }}>
        Generating your reflection…
      </p>
      <p className="text-xs" style={{ color: "#aaa" }}>
        This usually takes 10–20 seconds
      </p>
    </div>
  );
}

function ReviewView({
  debrief,
  isSubmitting,
  onApprove,
  onDiscard,
}: {
  debrief: DebriefRecord;
  isSubmitting: boolean;
  onApprove: (edited?: DebriefSummary) => void;
  onDiscard: () => void;
}) {
  const baseSummary = debrief.candidate_edited_summary ?? debrief.structured_summary;
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<DebriefSummary>(
    baseSummary ?? { approach: "", would_do_differently: "", what_learned: "" }
  );
  const [showTranscript, setShowTranscript] = useState(false);

  const sections: { key: keyof DebriefSummary; label: string }[] = [
    { key: "approach", label: "My Approach" },
    { key: "would_do_differently", label: "What I'd Do Differently" },
    { key: "what_learned", label: "What I Learned" },
  ];

  function handleApprove() {
    if (editMode) {
      onApprove(draft);
    } else {
      onApprove();
    }
  }

  if (!baseSummary) {
    return (
      <div className="p-7 flex flex-col gap-5">
        <h3 className="text-lg font-bold" style={{ color: NAVY }}>
          Review Your Reflection
        </h3>
        <p className="text-sm" style={{ color: "#888", lineHeight: 1.75 }}>
          Your call was recorded, but the summary could not be generated automatically.
          You can still approve your debrief to add the raw transcript to your portfolio,
          or discard it and try again.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => onApprove()}
            disabled={isSubmitting}
            className="flex-1 text-sm font-semibold py-3 text-white"
            style={{ backgroundColor: TEAL, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? "Approving…" : "Approve Anyway"}
          </button>
          <button
            onClick={onDiscard}
            disabled={isSubmitting}
            className="text-sm font-medium px-5 py-3"
            style={{ border: `1px solid ${BORDER}`, color: "#888", cursor: "pointer", background: "white" }}
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ maxHeight: "85vh", overflowY: "auto" }}>
      <div className="p-7 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase mb-1.5" style={{ color: TEAL, letterSpacing: "0.16em" }}>
              Your Reflection
            </p>
            <h3 className="text-lg font-bold" style={{ color: NAVY }}>
              Review Before Publishing
            </h3>
          </div>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="text-xs font-medium px-3 py-1.5 shrink-0"
              style={{ border: `1px solid ${BORDER}`, color: "#666", cursor: "pointer", background: "white" }}
            >
              Edit
            </button>
          )}
          {editMode && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  setDraft(baseSummary);
                  setEditMode(false);
                }}
                className="text-xs font-medium px-3 py-1.5"
                style={{ border: `1px solid ${BORDER}`, color: "#888", cursor: "pointer", background: "white" }}
              >
                Cancel
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="text-xs font-semibold px-3 py-1.5 text-white"
                style={{ backgroundColor: NAVY, cursor: "pointer" }}
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Summary sections */}
        <div className="flex flex-col gap-5">
          {sections.map(({ key, label }) => (
            <div key={key}>
              <p
                className="text-xs font-semibold uppercase mb-2"
                style={{ color: "#999", letterSpacing: "0.12em" }}
              >
                {label}
              </p>
              {editMode ? (
                <textarea
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  rows={4}
                  className="w-full text-sm resize-none outline-none p-3"
                  style={{
                    border: `1px solid ${TEAL}`,
                    color: NAVY,
                    lineHeight: 1.75,
                    borderRadius: "3px",
                  }}
                />
              ) : (
                <p className="text-sm" style={{ color: "#444", lineHeight: 1.8 }}>
                  {draft[key] || <em style={{ color: "#bbb" }}>Not captured</em>}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Raw transcript toggle */}
        {debrief.raw_transcript && (
          <div>
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="text-xs font-medium flex items-center gap-1.5"
              style={{ color: "#aaa", cursor: "pointer", background: "none", border: "none", padding: 0 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points={showTranscript ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
              </svg>
              {showTranscript ? "Hide transcript" : "Show full transcript"}
            </button>
            {showTranscript && (
              <div
                className="mt-3 p-4 text-xs"
                style={{
                  backgroundColor: "#F9FAFB",
                  border: `1px solid ${BORDER}`,
                  color: "#666",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  maxHeight: "180px",
                  overflowY: "auto",
                }}
              >
                {debrief.raw_transcript}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="flex-1 text-sm font-semibold py-3 text-white"
            style={{
              backgroundColor: TEAL,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Publishing…" : "Add to Portfolio →"}
          </button>
          <button
            onClick={onDiscard}
            disabled={isSubmitting}
            className="text-sm font-medium px-5 py-3"
            style={{
              border: `1px solid ${BORDER}`,
              color: "#888",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              background: "white",
            }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

function ApprovedView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-14 px-8 text-center">
      {/* Check icon */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: "56px", height: "56px", backgroundColor: "#D1FAE5" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <p className="text-base font-bold mb-1.5" style={{ color: NAVY }}>
          Reflection Published
        </p>
        <p className="text-sm" style={{ color: "#666", lineHeight: 1.75 }}>
          Your reflection has been added to your portfolio. Visitors will be
          able to read how you approached this simulation.
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-sm font-semibold px-8 py-3 text-white"
        style={{ backgroundColor: TEAL, cursor: "pointer" }}
      >
        Done
      </button>
    </div>
  );
}

function ErrorView({
  error,
  onClose,
}: {
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-12 px-8 text-center">
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: "52px", height: "52px", backgroundColor: "#FEF2F2" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div>
        <p className="text-base font-bold mb-1.5" style={{ color: NAVY }}>
          Something went wrong
        </p>
        <p className="text-sm" style={{ color: "#888", lineHeight: 1.75 }}>
          {error}
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-sm font-medium px-8 py-3"
        style={{ border: `1px solid ${BORDER}`, color: NAVY, cursor: "pointer", background: "white" }}
      >
        Close
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────

export function DebriefModal({ open, sessionId, onClose }: DebriefModalProps) {
  const [flowState, setFlowState] = useState<FlowState>("loading");
  const [debrief, setDebrief] = useState<DebriefRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const vapiRef = useRef<{
    start: (id: string, overrides: unknown) => Promise<unknown>;
    stop: () => void;
    on: (event: string, cb: (...args: unknown[]) => void) => void;
  } | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialise VAPI once on mount
  useEffect(() => {
    import("@vapi-ai/web").then(({ default: Vapi }) => {
      const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
      vapiRef.current = vapi as typeof vapiRef.current;

      vapi.on("call-start", () => {
        setFlowState("in_call");
        let secs = 0;
        callTimerRef.current = setInterval(() => {
          secs++;
          setCallDuration(secs);
        }, 1000);
      });

      vapi.on("call-end", () => {
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        setCallDuration(0);
        setIsAiSpeaking(false);
        setFlowState("processing");
      });

      vapi.on("speech-start", () => setIsAiSpeaking(true));
      vapi.on("speech-end", () => setIsAiSpeaking(false));

      vapi.on("error", () => {
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        setError(
          "The voice call encountered an error. Please check your microphone and try again."
        );
        setFlowState("error");
      });
    });

    return () => {
      vapiRef.current?.stop();
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  // Fetch/create debrief each time modal opens
  useEffect(() => {
    if (!open) return;

    setFlowState("loading");
    setDebrief(null);
    setError(null);

    async function init() {
      try {
        const res = await fetch("/api/debrief/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (res.status === 409) {
          const { debrief_id } = (await res.json()) as { debrief_id: string };
          const r2 = await fetch(`/api/debrief/${debrief_id}`);
          if (!r2.ok) throw new Error("Could not load existing debrief");
          const existing = (await r2.json()) as DebriefRecord;
          setDebrief(existing);
          if (existing.status === "pending_review") setFlowState("reviewing");
          else if (existing.status === "approved") setFlowState("approved");
          else setFlowState("pre_call");
          return;
        }

        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to start debrief");
        }

        const data = (await res.json()) as DebriefRecord;
        setDebrief(data);
        setFlowState("pre_call");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setFlowState("error");
      }
    }

    init();
  }, [open, sessionId]);

  // Poll for pending_review once processing starts
  useEffect(() => {
    if (flowState !== "processing" || !debrief?.id) return;

    const debriefId = debrief.id;
    let attempts = 0;
    const maxAttempts = 40; // 2 minutes at 3s intervals

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/debrief/${debriefId}`);
        if (res.ok) {
          const data = (await res.json()) as DebriefRecord;
          if (data.status === "pending_review") {
            setDebrief(data);
            setFlowState("reviewing");
          } else if (data.status === "failed") {
            setError("Your debrief could not be processed. Please try again.");
            setFlowState("error");
          }
        }
      } catch { /* continue polling */ }

      if (attempts >= maxAttempts) {
        setError(
          "Processing is taking longer than expected. Please check back later."
        );
        setFlowState("error");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [flowState, debrief?.id]);

  async function beginCall() {
    if (!vapiRef.current || !debrief?.id) return;

    const questions = debrief.questions_generated ?? [];
    const questionsText = questions
      .map((q, i) => `${i + 1}. ${q.question}`)
      .join("\n");

    setFlowState("call_connecting");

    try {
      await vapiRef.current.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!, {
        metadata: { debriefId: debrief.id },
        variableValues: { questions: questionsText },
      });
    } catch (err) {
      console.error("[vapi] start failed:", err);
      setError(
        "Could not start the voice call. Please check your microphone and try again."
      );
      setFlowState("error");
    }
  }

  function endCall() {
    vapiRef.current?.stop();
  }

  async function approveDebrief(editedSummary?: DebriefSummary) {
    if (!debrief?.id) return;
    setFlowState("approving");

    try {
      const body: Record<string, unknown> = {};
      if (editedSummary) body.candidate_edited_summary = editedSummary;

      const res = await fetch(`/api/debrief/${debrief.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const b = (await res.json()) as { error?: string };
        throw new Error(b.error ?? "Failed to approve debrief");
      }

      setFlowState("approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve debrief");
      setFlowState("error");
    }
  }

  async function discardDebrief() {
    if (debrief?.id) {
      await fetch(`/api/debrief/${debrief.id}/discard`, { method: "POST" }).catch(
        () => {}
      );
    }
    handleClose();
  }

  function handleClose() {
    if (flowState === "in_call" || flowState === "call_connecting") {
      endCall();
    }
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />
          <motion.div
            className="relative z-10 w-full max-w-xl bg-white shadow-2xl overflow-hidden"
            style={{ maxHeight: "90vh" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Close button */}
            {flowState !== "in_call" && flowState !== "call_connecting" && (
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 flex items-center justify-center w-7 h-7 rounded-full"
                style={{ color: "#aaa", background: "none", border: "none", cursor: "pointer" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            {/* Views */}
            {flowState === "loading" && <LoadingView />}

            {flowState === "pre_call" && debrief && (
              <PreCallView
                debrief={debrief}
                onBegin={beginCall}
                onClose={handleClose}
              />
            )}

            {flowState === "call_connecting" && <CallConnectingView />}

            {flowState === "in_call" && debrief && (
              <InCallView
                debrief={debrief}
                isAiSpeaking={isAiSpeaking}
                callDuration={callDuration}
                onEndCall={endCall}
              />
            )}

            {flowState === "processing" && <ProcessingView />}

            {(flowState === "reviewing" || flowState === "approving") &&
              debrief && (
                <ReviewView
                  debrief={debrief}
                  isSubmitting={flowState === "approving"}
                  onApprove={approveDebrief}
                  onDiscard={discardDebrief}
                />
              )}

            {flowState === "approved" && <ApprovedView onClose={onClose} />}

            {flowState === "error" && (
              <ErrorView
                error={error ?? "Something went wrong. Please try again."}
                onClose={handleClose}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

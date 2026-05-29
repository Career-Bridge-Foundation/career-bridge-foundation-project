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
  candidateName?: string;
  verdictBand?: string;
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
  onBegin,
  onClose,
}: {
  debrief: DebriefRecord;
  onBegin: () => void;
  onClose: () => void;
}) {
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
          An AI coach will ask you 2–3 short questions about your approach.
          Speak naturally — you can take your time. The conversation will be
          transcribed and summarised for your portfolio. You&apos;ll review and
          approve the summary before it appears.
        </p>
      </div>

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
      <div className="flex flex-col gap-3">
        <button
          onClick={onBegin}
          className="w-full text-sm font-semibold py-3 text-white text-center"
          style={{ backgroundColor: TEAL, cursor: "pointer" }}
        >
          Start voice debrief (5 minutes)
        </button>
        <div className="text-center">
          <button
            onClick={onClose}
            className="text-xs"
            style={{ color: "#aaa", cursor: "pointer", background: "none", border: "none", padding: 0 }}
          >
            Maybe later
          </button>
        </div>
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
  isAiSpeaking,
  callDuration,
  onEndCall,
}: {
  debrief: DebriefRecord;
  isAiSpeaking: boolean;
  callDuration: number;
  onEndCall: () => void;
}) {

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
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const summary = debrief.structured_summary;
  const [showTranscript, setShowTranscript] = useState(false);

  const sections: { key: keyof DebriefSummary; label: string }[] = [
    { key: "approach", label: "My Approach" },
    { key: "would_do_differently", label: "What I'd Do Differently" },
    { key: "what_learned", label: "What I Learned" },
  ];

  if (!summary) {
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
            onClick={onApprove}
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
        <div>
          <p className="text-xs font-semibold uppercase mb-1.5" style={{ color: TEAL, letterSpacing: "0.16em" }}>
            Your Reflection
          </p>
          <h3 className="text-lg font-bold" style={{ color: NAVY }}>
            Review Before Publishing
          </h3>
        </div>

        {/* Summary sections — read-only, Claude-generated */}
        <div className="flex flex-col gap-5">
          {sections.map(({ key, label }) => (
            <div key={key}>
              <p
                className="text-xs font-semibold uppercase mb-2"
                style={{ color: "#999", letterSpacing: "0.12em" }}
              >
                {label}
              </p>
              <p className="text-sm" style={{ color: "#444", lineHeight: 1.8 }}>
                {summary[key] || <em style={{ color: "#bbb" }}>Not captured</em>}
              </p>
            </div>
          ))}
        </div>

        {/* Raw transcript toggle — full height, no cap */}
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
            onClick={onApprove}
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

export function DebriefModal({ open, sessionId, onClose, candidateName, verdictBand }: DebriefModalProps) {
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
  const vapiCallIdRef = useRef<string | null>(null);

  // Initialise VAPI once on mount
  useEffect(() => {
    import("@vapi-ai/web").then(({ default: Vapi }) => {
      const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
      vapiRef.current = vapi as typeof vapiRef.current;

      vapi.on("call-start", (...args: unknown[]) => {
        const call = args[0];
        const callId = (call as { id?: string } | null)?.id ?? null;
        if (callId) vapiCallIdRef.current = callId;
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

  // Call the process endpoint when the call ends
  useEffect(() => {
    if (flowState !== "processing" || !debrief?.id) return;

    const debriefId = debrief.id;
    let cancelled = false;

    async function process() {
      try {
        const res = await fetch(`/api/debrief/${debriefId}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vapi_call_id: vapiCallIdRef.current }),
        });

        if (cancelled) return;

        if (res.status === 503) {
          // Transcript not ready yet — retry once after a short wait
          await new Promise((r) => setTimeout(r, 4000));
          if (cancelled) return;
          const retry = await fetch(`/api/debrief/${debriefId}/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vapi_call_id: vapiCallIdRef.current }),
          });
          if (cancelled) return;
          if (!retry.ok) {
            const b = (await retry.json()) as { error?: string };
            throw new Error(b.error ?? "Processing failed");
          }
          const data = (await retry.json()) as DebriefRecord;
          setDebrief(data);
          setFlowState("reviewing");
          return;
        }

        if (!res.ok) {
          const b = (await res.json()) as { error?: string };
          throw new Error(b.error ?? "Processing failed");
        }

        const data = (await res.json()) as DebriefRecord;
        setDebrief(data);
        setFlowState("reviewing");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to process your debrief. Please try again.");
        setFlowState("error");
      }
    }

    process();
    return () => { cancelled = true; };
  }, [flowState, debrief?.id]);

  async function beginCall() {
    if (!vapiRef.current || !debrief?.id) return;

    const questions = debrief.questions_generated ?? [];
    const questionsText = questions
      .map((q, i) => `${i + 1}. ${q.question}`)
      .join("\n");

    setFlowState("call_connecting");

    try {
      const call = await vapiRef.current.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!, {
        metadata: { debriefId: debrief.id },
        variableValues: {
          questions: questionsText,
          candidateName: candidateName ?? "there",
          verdictBand: verdictBand ?? "",
        },
      }) as { id?: string } | null;
      if (call?.id) vapiCallIdRef.current = call.id;
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

  async function approveDebrief() {
    if (!debrief?.id) return;
    setFlowState("approving");

    try {
      const res = await fetch(`/api/debrief/${debrief.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
            onClick={
              flowState === "call_connecting" ||
              flowState === "in_call" ||
              flowState === "processing"
                ? undefined
                : handleClose
            }
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

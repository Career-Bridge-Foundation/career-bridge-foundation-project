"use client";

import React from "react";

const NAVY = "#003359";
const TEAL = "#4DC5D2";
const BORDER = "#D5DCE8";

interface DebriefCardProps {
  sessionId: string | null;
  onStartDebrief: () => void;
  onSkip: () => void;
  passed: boolean;
}

export function DebriefCard({ sessionId, onStartDebrief, onSkip, passed }: DebriefCardProps) {
  if (!sessionId || !passed) return null;

  return (
    <div className="mb-14">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-px" style={{ backgroundColor: TEAL }} />
        <h2
          className="text-xs font-semibold uppercase"
          style={{ color: TEAL, letterSpacing: "0.16em" }}
        >
          Candidate Reflection
        </h2>
      </div>

      <div className="p-6" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-start gap-4">
          {/* Mic icon */}
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke={TEAL}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>

          <div className="flex-1">
            <p className="text-sm font-semibold mb-2" style={{ color: NAVY }}>
              Reflect on Your Work
            </p>
            <p className="text-sm mb-5" style={{ color: "#555", lineHeight: 1.75 }}>
              An AI coach will ask you 2–3 short questions about your approach.
              Speak naturally — you can take your time. The conversation will be
              transcribed and summarised for your portfolio. You&apos;ll review
              and approve the summary before it appears.
            </p>
            <div className="flex flex-col items-start gap-3">
              <button
                onClick={onStartDebrief}
                className="text-sm font-semibold px-6 py-3 text-white"
                style={{ backgroundColor: TEAL, cursor: "pointer" }}
              >
                Start voice debrief (5 minutes)
              </button>
              <button
                onClick={onSkip}
                className="text-xs"
                style={{ color: "#aaa", cursor: "pointer", background: "none", border: "none", padding: 0 }}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

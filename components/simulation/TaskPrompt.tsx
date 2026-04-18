"use client";

import type { Prompt } from "@/types";

interface TaskPromptProps {
  prompt: Prompt;
  currentStep: number;
  simulationRole: string;
  simulationCompany: string;
  briefShort: string;
  briefFull: string;
  videoTranscript: string;
  videoPresenterName: string;
  videoPresenterTitle: string;
  briefExpanded: boolean;
  onToggleBrief: () => void;
  transcriptOpen: boolean;
  onToggleTranscript: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function TaskPrompt({
  prompt,
  currentStep,
  simulationRole,
  simulationCompany,
  briefShort,
  briefFull,
  videoTranscript,
  videoPresenterName,
  videoPresenterTitle,
  briefExpanded,
  onToggleBrief,
  transcriptOpen,
  onToggleTranscript,
  muted,
  onToggleMute,
}: TaskPromptProps) {
  // console.log("Prompts ", prompt)
  return (
    <>
      {/* Scenario context card — Step 1 only */}
      {currentStep === 0 && (
        <div className="mb-6 p-5 bg-grey-bg border-l-4 border-l-teal">
          <span className="text-xs font-semibold uppercase text-[#999] tracking-brand-md block mb-2">
            Simulation Context
          </span>
          <p className="text-sm font-bold text-navy mb-2">
            {simulationRole} · {simulationCompany}
          </p>
          <p className="text-sm text-[#555] leading-[1.75]">
            {briefExpanded ? briefFull : briefShort}
          </p>
          <button
            onClick={onToggleBrief}
            className="mt-3 text-sm font-medium text-teal"
          >
            {briefExpanded ? "Hide full brief ↑" : "View full brief →"}
          </button>
        </div>
      )}

      {/* Video section */}
      <div className="mb-6 border border-border-light">
        {/* Video player placeholder */}
        <div className="relative w-full flex items-center justify-center bg-[#001a2e] aspect-video">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 bg-white/[0.08] border-2 border-white/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
            <p className="text-sm text-white/60">Video briefing · {simulationCompany}</p>
            <p className="text-xs mt-1 text-white/35">
              From {videoPresenterName || "Simulation Team"}
              {videoPresenterTitle ? `, ${videoPresenterTitle}` : ""}
            </p>
          </div>

          {/* Controls */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <button
              onClick={onToggleMute}
              className="video-control-btn flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              {muted ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                  Unmute
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                    <path d="M19.07,4.93a10,10,0,0,1,0,14.14" />
                    <path d="M15.54,8.46a5,5,0,0,1,0,7.07" />
                  </svg>
                  Mute
                </>
              )}
            </button>
            <button className="video-control-btn flex items-center gap-1.5 text-xs px-3 py-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="1,4 1,10 7,10" />
                <path d="M3.51,15a9,9,0,1,0,.49-3.87" />
              </svg>
              Replay
            </button>
          </div>
        </div>

        {/* Transcript toggle */}
        <div className="bg-white p-4">
          <button
            onClick={onToggleTranscript}
            className="flex items-center gap-2 text-xs font-medium text-teal"
          >
            {transcriptOpen ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="18,15 12,9 6,15" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6,9 12,15 18,9" />
              </svg>
            )}
            {transcriptOpen ? "Hide transcript" : "Show transcript"}
          </button>
          {transcriptOpen && (
            <div className="mt-4 pt-4 border-t border-border-light">
              <span className="text-xs font-semibold uppercase text-[#bbb] tracking-brand-sm block mb-2">
                Transcript
              </span>
              <p className="text-xs text-[#777] leading-[1.8]">{videoTranscript || "No transcript available."}</p>
            </div>
          )}
        </div>
      </div>

      {/* Prompt card */}
      <div className="mb-6 p-7 border border-border-light">
        <span className="text-xs font-semibold uppercase text-teal tracking-brand-lg block mb-3">
          Task {String(currentStep + 1).padStart(2, "0")}
        </span>
        <h2 className="text-xl font-bold text-navy leading-[1.3] mb-4">{prompt.title}</h2>
        <p className="text-base text-[#444] leading-[1.85]">{prompt.question}</p>
      </div>
    </>
  );
}

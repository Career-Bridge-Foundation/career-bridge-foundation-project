"use client";

import { cn } from "@/lib/cn";
import { useSimulation } from "@/hooks/useSimulation";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/simulation/LeftSidebar";
import { RightSidebar } from "@/components/simulation/RightSidebar";
import { TaskPrompt } from "@/components/simulation/TaskPrompt";
import { ResponseForm } from "@/components/simulation/ResponseForm";
import { SupportingEvidence } from "@/components/simulation/SupportingEvidence";
import { ChatWidget } from "@/components/simulation/ChatWidget";

export default function SimulationExecutionPage() {
  const params = useParams<{ id: string }>();
  const sim = useSimulation(params?.id);

  // console.log("Sims: ", sim)

  const promptCount = sim.prompts.length;
  const safeStep = Math.min(sim.currentStep, Math.max(promptCount - 1, 0));
  const prompt = sim.prompts[safeStep];
  const response = sim.responses[safeStep] ?? {};
  const minutesRemaining = sim.timeRemaining[safeStep] ?? 0;

  if (sim.loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header variant="solid" />
        <div className="pt-[120px] px-6 text-center text-sm text-[#666]">Loading simulation...</div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="min-h-screen bg-white">
        <Header variant="solid" />
        <div className="pt-[120px] px-6 text-center text-sm text-[#666]">Simulation data unavailable.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header variant="solid" />

      {/* ── MOBILE PROGRESS BAR ─────────────────────────────── */}
      <div className="lg:hidden fixed z-40 left-0 right-0 top-[73px] bg-white px-5 py-3 border-b border-border-light">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-navy">
            Task {safeStep + 1} of {promptCount} · {prompt.title}
          </span>
          <span className="text-xs text-[#999]">
            ~{minutesRemaining} mins left
          </span>
        </div>
        <div className="w-full h-1 rounded-full bg-border-light">
          <div
            className="h-1 rounded-full bg-teal transition-all duration-300"
            style={{ width: `${((safeStep + 1) / promptCount) * 100}%` }}
          />
        </div>
      </div>

      {/* ── THREE-COLUMN LAYOUT ─────────────────────────────── */}
      <div className="flex pt-[73px]">

        <LeftSidebar
          simulationTitle={sim.context.title}
          simulationCompany={sim.context.company}
          simulationIndustry={sim.context.industry}
          prompts={sim.prompts}
          currentStep={safeStep}
          lastSavedText={sim.lastSavedText}
        />

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        <main className="flex-1 min-w-0 mt-[52px] lg:mt-0">
          <div className="max-w-[700px] mx-auto px-6 py-8">

            {/* Top bar */}
            <div className="flex items-center justify-between mb-7">
              <span className="text-xs text-[#999]">Task {safeStep + 1} of {promptCount}</span>
              <div className="flex items-center gap-3">
                {sim.saveStatus === "saving" && (
                  <span className="text-xs italic text-[#bbb]">Saving…</span>
                )}
                {sim.saveStatus === "saved" && (
                  <span className="text-xs text-teal flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Saved
                  </span>
                )}
                <a
                  href="/simulations/product-management"
                  className="text-xs font-medium px-4 py-2 border border-navy text-navy"
                >
                  Exit Assessment
                </a>
              </div>
            </div>

            <TaskPrompt
              prompt={prompt}
              currentStep={safeStep}
              simulationRole={sim.context.role}
              simulationCompany={sim.context.company}
              briefShort={sim.context.briefShort}
              briefFull={sim.context.briefFull}
              videoTranscript={sim.context.videoTranscript}
              videoPresenterName={sim.context.videoPresenterName}
              videoPresenterTitle={sim.context.videoPresenterTitle}
              briefExpanded={sim.briefExpanded}
              onToggleBrief={() => sim.setBriefExpanded(!sim.briefExpanded)}
              transcriptOpen={sim.transcriptOpen}
              onToggleTranscript={() => sim.setTranscriptOpen(!sim.transcriptOpen)}
              muted={sim.muted}
              onToggleMute={() => sim.setMuted(!sim.muted)}
            />

            <ResponseForm
              prompt={prompt}
              response={response}
              onUpdate={sim.updateResponse}
            />

            <SupportingEvidence
              uploadedFiles={sim.uploadedFiles}
              attachedUrls={sim.attachedUrls}
              onFilesChange={sim.setUploadedFiles}
              onUrlsChange={sim.setAttachedUrls}
              fileInputRef={sim.fileInputRef}
            />

            {/* ── NAVIGATION BUTTONS ───────────────────────────── */}
            <div className="flex items-center justify-between pt-2 pb-16">
              <div>
                {sim.currentStep > 0 && (
                  <button
                    onClick={sim.goPrev}
                    className="text-sm font-medium px-6 py-3 border border-navy text-navy bg-white"
                  >
                    ← Previous
                  </button>
                )}
              </div>
              <button
                onClick={safeStep < promptCount - 1 ? sim.goNext : sim.saveToStorage}
                className={cn(
                  "text-sm font-semibold px-7 py-3 text-white",
                  safeStep === promptCount - 1 ? "bg-teal text-[0.9375rem]" : "bg-navy"
                )}
              >
                {safeStep < promptCount - 1 ? "Save and Continue →" : "Submit Simulation →"}
              </button>
            </div>

          </div>
        </main>

        {/* <RightSidebar prompt={prompt} currentStep={sim.currentStep} /> */}
        <RightSidebar prompt={prompt} minutesRemaining={minutesRemaining} />

      </div>

      <ChatWidget prompt={prompt} />
    </div>
  );
}

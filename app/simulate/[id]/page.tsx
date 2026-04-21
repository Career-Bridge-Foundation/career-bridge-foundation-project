"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { PROMPTS, TIME_REMAINING } from "@/lib/simulation-prompts";
import { useSimulation } from "@/hooks/useSimulation";
import { useEvaluation } from "@/hooks/useEvaluation";
import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/simulation/LeftSidebar";
import { RightSidebar } from "@/components/simulation/RightSidebar";
import { TaskPrompt } from "@/components/simulation/TaskPrompt";
import { ResponseForm } from "@/components/simulation/ResponseForm";
import { SupportingEvidence } from "@/components/simulation/SupportingEvidence";
import { ChatWidget } from "@/components/simulation/ChatWidget";
import type { StepResponse } from "@/types";

function buildResponseText(resp: StepResponse | undefined): string {
  if (!resp) return "";
  if (resp.text) return resp.text;
  const parts: string[] = [];
  if (resp.url) parts.push(`Document URL: ${resp.url}`);
  if (resp.rationale) parts.push(resp.rationale ?? "");
  return parts.filter(Boolean).join("\n\n");
}

export default function SimulationExecutionPage() {
  const params = useParams<{ id: string }>();
  const simulationId = params?.id ?? "product-strategy";
  const router = useRouter();

  const sim = useSimulation(simulationId);
  const { submitForEvaluation, isSubmitting } = useEvaluation();

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmitClick() {
    // Validate all tasks have content
    const incomplete = PROMPTS.some((_, i) =>
      buildResponseText(sim.responses[i]).trim().length === 0
    );
    if (incomplete) {
      setValidationError("Please complete all tasks before submitting.");
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setShowConfirm(true);
  }

  async function handleConfirmSubmit() {
    setShowConfirm(false);

    // Save all responses and flip session status to 'submitted' before calling the API
    await sim.markSubmitted();

    const responses = PROMPTS.map((p, i) => ({
      taskId: p.id,
      title: p.title,
      response: buildResponseText(sim.responses[i]),
    }));

    const redirectUrl = await submitForEvaluation(
      simulationId,
      responses,
      sim.sessionId,
      sim.userId
    );
    if (redirectUrl) {
      router.push(redirectUrl);
    } else {
      setSubmitError("Something went wrong during evaluation. Please try again.");
    }
  }

  const prompt = PROMPTS[sim.currentStep];
  const response = sim.responses[sim.currentStep] ?? {};

  return (
    <div className="min-h-screen bg-white">
      <Header variant="solid" />

      {/* ── MOBILE PROGRESS BAR ─────────────────────────────── */}
      <div className="lg:hidden fixed z-40 left-0 right-0 top-[73px] bg-white px-5 py-3 border-b border-border-light">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-navy">
            Task {sim.currentStep + 1} of 5 · {prompt.title}
          </span>
          <span className="text-xs text-[#999]">
            ~{TIME_REMAINING[sim.currentStep]} mins left
          </span>
        </div>
        <div className="w-full h-1 rounded-full bg-border-light">
          <div
            className="h-1 rounded-full bg-teal transition-all duration-300"
            style={{ width: `${((sim.currentStep + 1) / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* ── THREE-COLUMN LAYOUT ─────────────────────────────── */}
      <div className="flex pt-[73px]">

        <LeftSidebar
          currentStep={sim.currentStep}
          lastSavedText={sim.lastSavedText}
        />

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        <main className="flex-1 min-w-0 mt-[52px] lg:mt-0">
          <div className="max-w-[700px] mx-auto px-6 py-8">

            {/* Top bar */}
            <div className="flex items-center justify-between mb-7">
              <span className="text-xs text-[#999]">Task {sim.currentStep + 1} of 5</span>
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
              currentStep={sim.currentStep}
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
            <div className="flex flex-col gap-2 pt-2 pb-16">
              {/* Validation / error messages */}
              {validationError && (
                <p className="text-xs text-center" style={{ color: "#EF4444" }}>
                  {validationError}
                </p>
              )}
              {submitError && (
                <p className="text-xs text-center" style={{ color: "#EF4444" }}>
                  {submitError}
                </p>
              )}
              <div className="flex items-center justify-between">
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
                  onClick={sim.currentStep < 4 ? sim.goNext : handleSubmitClick}
                  disabled={isSubmitting}
                  className={cn(
                    "text-sm font-semibold px-7 py-3 text-white flex items-center gap-2",
                    sim.currentStep === 4 ? "bg-teal text-[0.9375rem]" : "bg-navy",
                    isSubmitting && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {sim.currentStep === 4 && isSubmitting ? (
                    <>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="white" strokeWidth="2.5" strokeLinecap="round"
                        style={{ animation: "spin 0.8s linear infinite" }}
                      >
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    sim.currentStep < 4 ? "Save and Continue →" : "Submit Simulation →"
                  )}
                </button>
              </div>
            </div>

          </div>
        </main>

        <RightSidebar prompt={prompt} currentStep={sim.currentStep} />

      </div>

      <ChatWidget prompt={prompt} />

      {/* ── CONFIRMATION MODAL ──────────────────────────────── */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div
            className="bg-white w-full max-w-sm p-8 flex flex-col gap-5"
            style={{ borderRadius: "4px" }}
          >
            <p className="text-base font-semibold" style={{ color: "#003359" }}>
              Ready to submit?
            </p>
            <p className="text-sm" style={{ color: "#555", lineHeight: 1.75 }}>
              You won&apos;t be able to edit your responses after submission.
              Make sure you&apos;re happy with all five tasks before continuing.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-sm font-medium px-5 py-2.5 border"
                style={{ borderColor: "#003359", color: "#003359", backgroundColor: "#fff" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="text-sm font-semibold px-5 py-2.5 text-white"
                style={{ backgroundColor: "#003359" }}
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

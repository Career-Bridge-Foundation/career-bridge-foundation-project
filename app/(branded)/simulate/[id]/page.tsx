"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useSimulationContent } from "@/hooks/useSimulationContent";
import { useSimulation } from "@/hooks/useSimulation";
import { useEvaluation } from "@/hooks/useEvaluation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LeftSidebar } from "@/components/simulation/LeftSidebar";
import { RightSidebar } from "@/components/simulation/RightSidebar";
import { TaskPrompt } from "@/components/simulation/TaskPrompt";
import { ResponseForm } from "@/components/simulation/ResponseForm";
import { SupportingEvidence } from "@/components/simulation/SupportingEvidence";
import { SubmitConfirmationModal } from "@/components/simulation/SubmitConfirmationModal";
import { ChatWidget } from "@/components/simulation/ChatWidget";
import { collectSubmitWarnings } from "@/lib/simulation/submitWarnings";
import type { SubmitWarning } from "@/lib/simulation/submitWarnings";
import { createClient } from "@/lib/supabase/client";
import { checkSimulationAccess } from "@/lib/access-control";
import type { StepResponse } from "@/types";

// ── Access gate states ────────────────────────────────────────
type AccessStatus = "loading" | "granted" | "denied" | "unauthenticated" | "profile_incomplete";

// ── Profile incomplete screen ─────────────────────────────────
function ProfileIncompleteScreen() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="solid" />
      <div
        className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ paddingTop: "120px", paddingBottom: "80px" }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#003359"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
        <h1 className="text-2xl font-bold" style={{ color: "#003359" }}>
          Complete your profile first
        </h1>
        <p className="text-sm max-w-sm" style={{ color: "#666", lineHeight: 1.75 }}>
          Add your name to your profile before starting a simulation. It takes less than a minute.
        </p>
        <a
          href="/account/profile?onboarding=1"
          className="text-sm font-semibold px-8 py-3.5 text-white"
          style={{ backgroundColor: "#003359" }}
        >
          Complete Your Profile →
        </a>
        <a
          href="/simulations"
          className="text-sm font-medium"
          style={{ color: "#003359" }}
        >
          Back to Simulations
        </a>
      </div>
    </div>
  );
}

// ── Paywall screen ────────────────────────────────────────────
function PaywallScreen() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="solid" />
      <div
        className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ paddingTop: "120px", paddingBottom: "80px" }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#003359"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h1 className="text-2xl font-bold" style={{ color: "#003359" }}>
          No access to this simulation
        </h1>
        <p className="text-sm max-w-sm" style={{ color: "#666", lineHeight: 1.75 }}>
          You don&rsquo;t have access to this simulation yet. Please contact the
          organisation that gave you access to get set up.
        </p>
        <a
          href="/simulations"
          className="text-sm font-semibold px-8 py-3.5 text-white"
          style={{ backgroundColor: "#003359" }}
        >
          Back to Simulations
        </a>
      </div>
    </div>
  );
}

function buildResponseText(resp: StepResponse | undefined): string {
  if (!resp) return "";
  if (resp.text) return resp.text;
  if (resp.file?.name) return `[Uploaded document: ${resp.file.name}]`;
  if (resp.rationale) return resp.rationale;
  return "";
}

function isResponseComplete(resp: StepResponse | undefined): boolean {
  if (!resp) return false;
  return !!(resp.text?.trim() || resp.file?.name || resp.url?.trim() || resp.rationale?.trim());
}

export default function SimulationExecutionPage() {
  const params = useParams<{ id: string }>();
  const simulationId = params?.id ?? "product-strategy";
  const content = useSimulationContent(simulationId);
  const prompts = content.prompts;
  const timeRemaining = content.timeRemaining;
  const router = useRouter();

  const sim = useSimulation(simulationId, content.discipline ?? "Product Management");
  const { submitForEvaluation, isSubmitting } = useEvaluation();

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitWarnings, setSubmitWarnings] = useState<SubmitWarning[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("loading");
  const [viaEntitlement, setViaEntitlement] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalMsgIndex, setEvalMsgIndex] = useState(0);
  const [evalVisible, setEvalVisible] = useState(true);

  const EVAL_MESSAGES = [
    ...prompts.map((p, i) => `Reviewing Task ${i + 1}: ${p.title}…`),
    "Checking your work against the rubric…",
    "Drafting per-task feedback…",
    "Compiling your assessment report…",
  ];

  // ── Access check on mount ────────────────────────────────────
  useEffect(() => {
    async function checkAccess() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAccessStatus("unauthenticated");
        return;
      }

      // Profile gate: full_name must be set and not be the placeholder
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = profile?.full_name?.trim() ?? "";
      if (!name || name === "Career Bridge Candidate") {
        setAccessStatus("profile_incomplete");
        return;
      }

      // Wait for simulation content before the discipline-aware access check —
      // content.discipline loads async. Auth/profile above already ran, so an
      // unauthenticated user has already been redirected by this point.
      if (content.loading) return;

      const { hasAccess, viaEntitlement: ve } = await checkSimulationAccess(user.id, content.discipline ?? undefined);
      setViaEntitlement(ve);
      setAccessStatus(hasAccess ? "granted" : "denied");
    }

    checkAccess().catch(() => setAccessStatus("unauthenticated"));
  }, [content.loading, content.discipline]);

  // ── Redirect unauthenticated users (side effect, not during render) ──
  useEffect(() => {
    if (accessStatus === "unauthenticated") {
      router.replace(`/auth/login?redirect=/simulate/${simulationId}`);
    }
  }, [accessStatus, simulationId, router]);

  // ── Evaluation message cycling ────────────────────────────────
  useEffect(() => {
    if (!isEvaluating) return;
    let cancelled = false;
    const id = setInterval(() => {
      setEvalVisible(false);
      setTimeout(() => {
        if (!cancelled) {
          setEvalMsgIndex(i => (i + 1) % EVAL_MESSAGES.length);
          setEvalVisible(true);
        }
      }, 300);
    }, 7000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isEvaluating]);

  function handleSubmitClick() {
    // Validate all tasks have content (text, uploaded file, or rationale)
    const incomplete = prompts.some((_, i) => !isResponseComplete(sim.responses[i]));
    if (incomplete) {
      setValidationError("Please complete all tasks before submitting.");
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setSubmitWarnings(
      collectSubmitWarnings(prompts, sim.responses, sim.evidenceByTask)
    );
    setShowConfirm(true);
  }

  async function handleConfirmSubmit() {
    setShowConfirm(false);
    setIsEvaluating(true);

    // Save all responses and flip session status to 'submitted' before calling the API
    await sim.markSubmitted();

    // Consume one simulation credit — but NOT for entitlement-based access,
    // which grants unmetered discipline access (no credit cost).
    if (!viaEntitlement) {
      const consumeRes = await fetch("/api/purchases/consume", { method: "POST" });
      if (!consumeRes.ok && consumeRes.status !== 403) {
        console.warn("[simulate] Credit consume returned", consumeRes.status);
      }
    }

    const responses = prompts.map((p, i) => {
      const stepResp = sim.responses[i] ?? {};
      const attachments: import("@/hooks/useEvaluation").TaskAttachment[] = [];
      if (stepResp.file?.filePath) {
        attachments.push({ type: "file", path: stepResp.file.filePath });
      }
      const evidence = sim.evidenceByTask[p.id];
      if (evidence) {
        for (const f of evidence.files) {
          if (f.filePath) attachments.push({ type: "file", path: f.filePath, isEvidence: true });
        }
      }
      return {
        taskId: p.id,
        title: p.title,
        response: buildResponseText(stepResp),
        ...(attachments.length > 0 ? { attachments } : {}),
      };
    });

    // Enforce a 1.5s minimum so the loading screen is always visible long enough
    const [redirectUrl] = await Promise.all([
      submitForEvaluation(simulationId, responses, sim.sessionId, sim.userId),
      new Promise<void>(resolve => setTimeout(resolve, 1500)),
    ]);

    if (redirectUrl) {
      router.push(redirectUrl);
    } else {
      setIsEvaluating(false);
      setSubmitError("Something went wrong during evaluation. Please try again.");
    }
  }

  const response = sim.responses[sim.currentStep] ?? {};

  // ── Access gate ───────────────────────────────────────────────
  if (accessStatus === "unauthenticated") {
    return null;
  }

  if (accessStatus === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="text-sm text-gray-400">Loading…</span>
      </div>
    );
  }

  if (accessStatus === "profile_incomplete") {
    return <ProfileIncompleteScreen />;
  }

  if (accessStatus === "denied") {
    return <PaywallScreen />;
  }

  if (content.loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="text-sm text-gray-400">Loading…</span>
      </div>
    );
  }

  if (content.notFound || prompts.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header variant="solid" />
        <div
          className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ paddingTop: "120px", paddingBottom: "80px" }}
        >
          <h1 className="text-2xl font-bold" style={{ color: "#003359" }}>
            Simulation not found.
          </h1>
          <a
            href="/simulations"
            className="text-sm font-medium"
            style={{ color: "#003359" }}
          >
            Back to Simulations
          </a>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Evaluating state: Header + card + Footer, no overlay ──────
  if (isEvaluating) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header variant="solid" />
        <main
          className="flex-1 flex flex-col items-center justify-center px-6"
          style={{ paddingTop: "80px", paddingBottom: "80px" }}
        >
          <div
            className="flex flex-col items-center gap-7 px-10 py-12"
            style={{
              border: "1px solid #D5DCE8",
              maxWidth: "420px",
              width: "100%",
            }}
          >
            <img
              src="/evidentize-icon.png"
              alt="Evidentize"
              style={{ width: "48px", height: "auto", objectFit: "contain" }}
            />
            <h2
              className="text-center"
              style={{ color: "#003359", fontWeight: 600, fontSize: "18px", lineHeight: 1.4 }}
            >
              Evaluating your responses…
            </h2>
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                height: "4px",
                width: "100%",
                backgroundColor: "#E5E7EB",
                borderRadius: "9999px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  backgroundColor: "#4DC5D2",
                  borderRadius: "9999px",
                  animation: "cb-eval-progress 1.8s ease-in-out infinite",
                }}
              />
            </div>
            <p
              className="text-center"
              style={{
                color: "#555",
                fontSize: "13px",
                opacity: evalVisible ? 1 : 0,
                transition: "opacity 0.3s ease",
                minHeight: "20px",
              }}
            >
              {EVAL_MESSAGES[evalMsgIndex]}
            </p>
            <div
              style={{
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid #e5e7eb",
                fontSize: "12px",
                color: "#666",
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>
                Evaluations typically take around 90 seconds.
              </p>
              <p style={{ margin: "4px 0 0 0" }}>
                Please keep this tab open and don't refresh — your responses are being assessed.
              </p>
            </div>
          </div>
        </main>
        <Footer />
        <style>{`
          @keyframes cb-eval-progress {
            0%   { left: -45%; width: 45%; }
            100% { left: 110%; width: 45%; }
          }
        `}</style>
      </div>
    );
  }

  const prompt = prompts[sim.currentStep];

  return (
    <div className="min-h-screen bg-white">
      <Header variant="solid" />

      {/* ── MOBILE PROGRESS BAR ─────────────────────────────── */}
      <div className="lg:hidden fixed z-40 left-0 right-0 top-[73px] bg-white px-5 py-3 border-b border-border-light">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-navy">
            Task {sim.currentStep + 1} of {prompts.length} · {prompt.title}
          </span>
          <span className="text-xs text-[#999]">
            ~{timeRemaining[sim.currentStep]} mins left
          </span>
        </div>
        <div className="w-full h-1 rounded-full bg-border-light">
          <div
            className="h-1 rounded-full bg-teal transition-all duration-300"
            style={{ width: `${((sim.currentStep + 1) / prompts.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ── THREE-COLUMN LAYOUT ─────────────────────────────── */}
      <div className="flex pt-[73px]">

        <LeftSidebar
          currentStep={sim.currentStep}
          lastSavedText={sim.lastSavedText}
          sim={content.sim}
          prompts={prompts}
        />

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        <main className="flex-1 min-w-0 mt-[52px] lg:mt-0">
          <div className="max-w-[700px] mx-auto px-6 py-8">

            {/* Top bar */}
            <div className="flex items-center justify-between mb-7">
              <span className="text-xs text-[#999]">Task {sim.currentStep + 1} of {prompts.length}</span>
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
                <Link
                  href="/simulations/product-management"
                  className="text-xs font-medium px-4 py-2 border border-navy text-navy"
                >
                  Exit Assessment
                </Link>
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
              sim={content.sim}
              briefShort={content.briefShort}
              briefFull={content.briefFull}
              transcript={content.transcript}
              videoUrl={content.videoUrl}
            />

            <ResponseForm
              prompt={prompt}
              response={response}
              onUpdate={sim.updateResponse}
              onFileSelect={(file) => sim.handleFileSelect(file, prompt.id)}
              uploading={sim.uploadingTaskId === prompt.id}
              uploadError={sim.uploadingTaskId === null ? sim.fileUploadError : null}
            />

            <SupportingEvidence
              uploadedFiles={sim.evidenceByTask[prompt.id]?.files ?? []}
              onFileSelect={(file) => sim.handleEvidenceFileSelect(file, prompt.id)}
              onFileRemove={(filePath) => sim.handleEvidenceFileRemove(filePath, prompt.id)}
              uploading={sim.evidenceUploading}
              uploadError={sim.evidenceUploadError}
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
                  onClick={sim.currentStep < prompts.length - 1 ? sim.goNext : handleSubmitClick}
                  disabled={isSubmitting || isEvaluating}
                  className={cn(
                    "text-sm font-semibold px-7 py-3 text-white flex items-center gap-2",
                    sim.currentStep === prompts.length - 1 ? "bg-teal text-[0.9375rem]" : "bg-navy",
                    (isSubmitting || isEvaluating) && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {sim.currentStep === prompts.length - 1 && isSubmitting ? (
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
                    sim.currentStep < prompts.length - 1 ? "Save and Continue →" : "Submit Simulation →"
                  )}
                </button>
              </div>
            </div>

          </div>
        </main>

        <RightSidebar prompt={prompt} currentStep={sim.currentStep} timeRemaining={timeRemaining} />

      </div>

      <ChatWidget prompt={prompt} />

      <SubmitConfirmationModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmSubmit}
        warnings={submitWarnings}
        isSubmitting={isSubmitting || isEvaluating}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

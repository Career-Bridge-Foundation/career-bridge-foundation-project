"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useSimulationContent } from "@/hooks/useSimulationContent";
import { usePracticeRun } from "@/hooks/usePracticeRun";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LeftSidebar } from "@/components/simulation/LeftSidebar";
import { RightSidebar } from "@/components/simulation/RightSidebar";
import { TaskPrompt } from "@/components/simulation/TaskPrompt";
import { ResponseForm } from "@/components/simulation/ResponseForm";
import { PracticeFeedbackScreen } from "@/components/simulation/PracticeFeedbackScreen";
import { AssessmentPackModal } from "@/components/simulation/AssessmentPackModal";
import { createClient } from "@/lib/supabase/client";

// ── Access gate states ────────────────────────────────────────
// No entitlement check here at all (Spec 14 decision 2) — only auth and a
// complete profile, same minimum bar as every other authenticated page.
// TODO(Spec 19): once the acceptance-gate exists, check it here alongside
// auth/profile — see upgraded Spec 14 decision 2 ("acceptance gate ... and
// partner suspension" are the only gates). No acceptance-gate infrastructure
// exists in this codebase yet; until then practice stays open to every
// authenticated candidate with a complete profile, unchanged.
type AccessStatus = "loading" | "granted" | "profile_incomplete";

function ProfileIncompleteScreen() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="solid" />
      <div
        className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ paddingTop: "120px", paddingBottom: "80px" }}
      >
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-navy)" }}>
          Complete your profile first
        </h1>
        <p className="text-sm max-w-sm" style={{ color: "#666", lineHeight: 1.75 }}>
          Add your name to your profile before starting a practice trial. It takes less than a minute.
        </p>
        <a
          href="/account/profile?onboarding=1"
          className="text-sm font-semibold px-8 py-3.5 text-white"
          style={{ backgroundColor: "var(--color-navy)" }}
        >
          Complete Your Profile →
        </a>
        <Link href="/simulations" className="text-sm font-medium" style={{ color: "var(--color-navy)" }}>
          Back to Simulations
        </Link>
      </div>
    </div>
  );
}

function isResponseComplete(resp: { text?: string; file?: { name: string } | null; url?: string; rationale?: string } | undefined): boolean {
  if (!resp) return false;
  return !!(resp.text?.trim() || resp.file?.name || resp.url?.trim() || resp.rationale?.trim());
}

export default function PracticeExecutionPage() {
  const params = useParams<{ id: string }>();
  const simulationId = params?.id ?? "";
  const content = useSimulationContent(simulationId);
  const prompts = content.prompts;
  const timeRemaining = content.timeRemaining;
  const router = useRouter();

  const run = usePracticeRun(content.simulationUuid);

  const [accessStatus, setAccessStatus] = useState<AccessStatus>("loading");
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── Credit-funded upgrade to a full assessed run (Spec 20) ─────
  // Only offered when the candidate already holds a credit — checked
  // separately from the access gate above, which intentionally never
  // blocks on entitlement/credits for the free practice flow itself.
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchBalance() {
      try {
        const res = await fetch("/api/candidate/entitlement");
        const data = await res.json();
        if (!cancelled && res.ok) setCreditBalance(data.balance?.total ?? 0);
      } catch {
        // fail-quiet: no upgrade offer shown, free practice flow is unaffected
      }
    }
    fetchBalance();
    return () => { cancelled = true; };
  }, []);

  // ── Auth + profile check only — no entitlement/credit check ────
  useEffect(() => {
    async function checkAccess() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        const redirect = encodeURIComponent(window.location.pathname);
        window.location.replace(`/auth/login?redirect=${redirect}`);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user.id)
        .maybeSingle();
      const name = profile?.full_name?.trim() ?? "";
      if (!name || name === "Career Bridge Candidate") {
        setAccessStatus("profile_incomplete");
        return;
      }

      setAccessStatus("granted");
    }

    checkAccess().catch(() => {
      const redirect = encodeURIComponent(window.location.pathname);
      window.location.replace(`/auth/login?redirect=${redirect}`);
    });
  }, []);

  function handleSubmit() {
    const incomplete = prompts.some((_, i) => !isResponseComplete(run.responses[i]));
    if (incomplete) {
      setValidationError("Please complete all tasks before submitting.");
      return;
    }
    setValidationError(null);
    run.submit(prompts);
  }

  const response = run.responses[run.currentStep] ?? {};

  // ── Access gate ───────────────────────────────────────────────
  if (accessStatus === "loading" || content.loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="text-sm text-gray-400">Loading…</span>
      </div>
    );
  }

  if (accessStatus === "profile_incomplete") {
    return <ProfileIncompleteScreen />;
  }

  if (content.notFound || prompts.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header variant="solid" />
        <div
          className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ paddingTop: "120px", paddingBottom: "80px" }}
        >
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-navy)" }}>
            Practice trial not found.
          </h1>
          <Link href="/simulations" className="text-sm font-medium" style={{ color: "var(--color-navy)" }}>
            Back to Simulations
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (content.simulationType && content.simulationType !== "practice") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header variant="solid" />
        <div
          className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ paddingTop: "120px", paddingBottom: "80px" }}
        >
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-navy)" }}>
            This is an assessed simulation.
          </h1>
          <p className="text-sm max-w-sm" style={{ color: "#666", lineHeight: 1.75 }}>
            It requires an Assessment Credit — start it from the simulations catalogue.
          </p>
          <Link href="/simulations" className="text-sm font-medium" style={{ color: "var(--color-navy)" }}>
            Back to Simulations
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Feedback screen (post-submit) ───────────────────────────────
  if (run.feedback) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header variant="solid" />
        <PracticeFeedbackScreen
          feedback={run.feedback}
          simulationTitle={content.sim?.title ?? "Practice Trial"}
          discipline={content.discipline}
        />
        <Footer />
      </div>
    );
  }

  const prompt = prompts[run.currentStep];

  return (
    <div className="min-h-screen bg-white">
      <Header variant="solid" />

      {/* ── PRACTICE BANNER ─────────────────────────────────── */}
      <div className="fixed z-40 left-0 right-0 top-[73px] bg-[#E6F7F8] border-b border-teal/30 px-5 py-2 text-center flex items-center justify-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-navy">
          Free Practice Trial — no score, no credential, no AI Simulation Assistant. You
          work this one unaided; assessed runs include a live assistant. Replay as many
          times as you like.
        </span>
        {creditBalance > 0 && (
          <button
            type="button"
            onClick={() => setUpgradeModalOpen(true)}
            className="text-xs font-semibold text-white px-3 py-1 rounded-md bg-navy hover:opacity-90 whitespace-nowrap"
          >
            Use 1 credit for full assessed access →
          </button>
        )}
      </div>

      {content.simulationUuid && (
        <AssessmentPackModal
          open={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          onActivated={() => router.push(`/simulate/${simulationId}`)}
          simulationId={content.simulationUuid}
          simulationTitle={content.sim?.title ?? "Practice Trial"}
        />
      )}

      {/* ── MOBILE PROGRESS BAR ─────────────────────────────── */}
      <div className="lg:hidden fixed z-40 left-0 right-0 top-[105px] bg-white px-5 py-3 border-b border-border-light">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-navy">
            Task {run.currentStep + 1} of {prompts.length} · {prompt.title}
          </span>
          <span className="text-xs text-[#999]">~{timeRemaining[run.currentStep]} mins left</span>
        </div>
        <div className="w-full h-1 rounded-full bg-border-light">
          <div
            className="h-1 rounded-full bg-teal transition-all duration-300"
            style={{ width: `${((run.currentStep + 1) / prompts.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ── THREE-COLUMN LAYOUT ─────────────────────────────── */}
      <div className="flex pt-[105px]">
        {/* mt-8 clears the banner's ~32px height so the sidebar's own
            sticky top-[73px] (baked into LeftSidebar, shared with the
            assessed page) doesn't sit under it — it still sticks flush
            to the header once scrolled past the banner. */}
        <div className="hidden lg:block shrink-0 mt-8">
          <LeftSidebar
            currentStep={run.currentStep}
            lastSavedText={() => "Practice runs aren't saved between visits"}
            sim={content.sim}
            prompts={prompts}
          />
        </div>

        <main className="flex-1 min-w-0 mt-[52px] lg:mt-0">
          <div className="max-w-[700px] mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-7">
              <span className="text-xs text-[#999]">Task {run.currentStep + 1} of {prompts.length}</span>
              <Link
                href={content.discipline ? `/simulations/${content.discipline}` : "/simulations"}
                className="text-xs font-medium px-4 py-2 border border-navy text-navy"
              >
                Exit Practice
              </Link>
            </div>

            <TaskPrompt
              prompt={prompt}
              currentStep={run.currentStep}
              briefExpanded={false}
              onToggleBrief={() => {}}
              transcriptOpen={false}
              onToggleTranscript={() => {}}
              muted={true}
              onToggleMute={() => {}}
              sim={content.sim}
              briefShort={content.briefShort}
              briefFull={content.briefFull}
              transcript={content.transcript}
              videoUrl={content.videoUrl}
            />

            <ResponseForm
              prompt={prompt}
              response={response}
              onUpdate={run.updateResponse}
              onFileSelect={(file) => run.handleFileSelect(file, prompt.id)}
              uploading={run.uploadingTaskId === prompt.id}
              uploadError={run.uploadingTaskId === null ? run.fileUploadError : null}
            />

            <div className="flex flex-col gap-2 pt-2 pb-16">
              {validationError && (
                <p className="text-xs text-center" style={{ color: "#EF4444" }}>{validationError}</p>
              )}
              {run.submitError && (
                <p className="text-xs text-center" style={{ color: "#EF4444" }}>{run.submitError}</p>
              )}
              <div className="flex items-center justify-between">
                <div>
                  {run.currentStep > 0 && (
                    <button
                      onClick={run.goPrev}
                      className="text-sm font-medium px-6 py-3 border border-navy text-navy bg-white"
                    >
                      ← Previous
                    </button>
                  )}
                </div>
                <button
                  onClick={run.currentStep < prompts.length - 1 ? run.goNext : handleSubmit}
                  disabled={run.isSubmitting}
                  className={cn(
                    "text-sm font-semibold px-7 py-3 text-white flex items-center gap-2",
                    run.currentStep === prompts.length - 1 ? "bg-teal text-[0.9375rem]" : "bg-navy",
                    run.isSubmitting && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {run.currentStep === prompts.length - 1 && run.isSubmitting
                    ? "Submitting..."
                    : run.currentStep < prompts.length - 1
                      ? "Save and Continue →"
                      : "Get Feedback →"}
                </button>
              </div>
            </div>
          </div>
        </main>

        <div className="hidden xl:block shrink-0 mt-8">
          <RightSidebar prompt={prompt} currentStep={run.currentStep} timeRemaining={timeRemaining} />
        </div>
      </div>
    </div>
  );
}

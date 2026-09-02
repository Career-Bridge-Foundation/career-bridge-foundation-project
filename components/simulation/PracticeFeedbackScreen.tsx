"use client";

import Link from "next/link";
import type { PracticeFeedback } from "@/hooks/usePracticeRun";

interface PracticeFeedbackScreenProps {
  feedback: PracticeFeedback;
  simulationTitle: string;
  discipline: string | null;
}

/**
 * Shown after a Practice Trial submission. Deliberately has no band, score,
 * or readiness figure — feedback is qualitative only (Spec 14 decision 6).
 * Copy must not imply practice performance predicts an assessed band
 * (spec's explicit requirement) and must state plainly that scoring,
 * debrief, portfolio publication, and credentials require an Assessment
 * Credit — this screen is the natural conversion moment into Spec 15's
 * purchase flow.
 */
export function PracticeFeedbackScreen({ feedback, simulationTitle, discipline }: PracticeFeedbackScreenProps) {
  const catalogueHref = discipline ? `/simulations/${discipline}` : "/simulations";

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 py-16">
      <div className="max-w-[560px] w-full">
        <span className="text-xs font-semibold uppercase text-teal tracking-brand-md block mb-2">
          Practice Complete
        </span>
        <h1 className="text-2xl font-bold text-navy mb-2">{simulationTitle}</h1>
        <p className="text-sm text-[#666] mb-10 leading-relaxed">
          This is quick feedback from a free practice run — not a professional assessment.
          It doesn&apos;t reflect a verdict band, score, or readiness level, so a strong
          practice run doesn&apos;t predict an assessed result and a weaker one doesn&apos;t
          either.
        </p>

        <div className="border border-border-light p-6 mb-4">
          <span className="text-xs font-semibold uppercase text-teal tracking-brand-md block mb-2">
            Strength
          </span>
          <p className="text-sm text-[#333] leading-relaxed">{feedback.strength}</p>
        </div>

        <div className="border border-border-light p-6 mb-10">
          <span className="text-xs font-semibold uppercase text-[#888] tracking-brand-md block mb-3">
            Areas to develop
          </span>
          <ul className="flex flex-col gap-3">
            {feedback.gaps.map((gap, i) => (
              <li key={i} className="text-sm text-[#333] leading-relaxed flex gap-2">
                <span className="text-[#bbb]">—</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#F3F3F3] p-6 mb-6">
          <h2 className="text-sm font-bold text-navy mb-2">Want the real thing?</h2>
          <p className="text-xs text-[#666] leading-relaxed mb-4">
            Professional assessment, scoring, an AI voice debrief, portfolio evidence, and a
            verified credential all require an Assessment Credit.
          </p>
          <Link
            href={catalogueHref}
            className="inline-block text-sm font-semibold px-6 py-3 text-white bg-navy"
          >
            Browse Assessed Simulations →
          </Link>
        </div>

        <Link href={catalogueHref} className="text-sm font-medium text-navy">
          ← Back to Simulations
        </Link>
      </div>
    </div>
  );
}

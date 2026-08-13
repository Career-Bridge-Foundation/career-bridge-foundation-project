"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Simulation } from "@/types";
import { AssessmentPackModal } from "@/components/simulation/AssessmentPackModal";

interface SimulationCardProps {
  simulation: Simulation;
  hasAccess: boolean | null;
}

export function SimulationCard({ simulation: sim, hasAccess }: SimulationCardProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const isAssessed = sim.simulation_type === "assessed";

  function handleStart() {
    if (hasAccess === null) return; // still loading access state

    if (isAssessed && sim.simulation_uuid) {
      // For assessed simulations: show the Assessment Pack modal.
      // The modal handles all credit scenarios (balance_first, balance_repeat, no_balance).
      setModalOpen(true);
      return;
    }

    if (!isAssessed) {
      // Practice Trials: free, unlimited, no entitlement check at all
      // (Spec 14 decision 2) — never route through the /no-access guard.
      router.push(`/practice/${sim.slug}`);
      return;
    }

    // Assessed without a resolved UUID yet: old route guard
    router.push(
      hasAccess
        ? `/simulations/${sim.discipline}/${sim.slug}`
        : "/no-access"
    );
  }

  function handleActivated(_activationId: string) {
    setModalOpen(false);
    router.push(`/simulations/${sim.discipline}/${sim.slug}`);
  }

  return (
    <>
      <div className="bg-white flex flex-col p-8">
        {/* Practice badge — distinction must be legible before Start (Spec 14) */}
        {!isAssessed && (
          <span className="self-start mb-3 text-[10px] font-semibold uppercase tracking-brand-xs px-2.5 py-1 bg-teal/10 text-teal">
            Free Practice
          </span>
        )}

        {/* Title + company */}
        <h3 className="text-base font-bold text-navy leading-[1.35] mb-1">{sim.title}</h3>
        <p className="text-xs text-[#888] mb-4">
          {sim.company} &middot; {sim.industry}
        </p>

        {/* Description */}
        <p className="text-sm text-[#555] leading-[1.75] flex-1">{sim.description}</p>

        {/* Divider + bottom row */}
        <div className="mt-6 pt-5 flex items-center justify-between border-t border-border-light">
          <span className="flex items-center gap-1.5 text-xs text-[#999]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {sim.time}
          </span>
          <button
            onClick={handleStart}
            disabled={hasAccess === null}
            className="text-sm font-medium text-teal hover:underline disabled:opacity-40 cursor-pointer"
          >
            Start Simulation →
          </button>
        </div>
      </div>

      {/* Assessment Pack modal — only rendered for assessed simulations with a resolved UUID */}
      {isAssessed && sim.simulation_uuid && (
        <AssessmentPackModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onActivated={handleActivated}
          simulationId={sim.simulation_uuid}
          simulationTitle={sim.title}
          returnTo={`/simulations/${sim.discipline}/${sim.slug}`}
        />
      )}
    </>
  );
}

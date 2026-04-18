import Link from "next/link";
import { TypeBadge, DifficultyBadge } from "@/components/ui/badge";
import type { Simulation } from "@/types";

interface SimulationCardProps {
  simulation: Simulation;
}

export function SimulationCard({ simulation: sim }: SimulationCardProps) {
  return (
    <div className="bg-white flex flex-col p-8">
      {/* Top badges */}
      <div className="flex flex-wrap gap-2 mb-5">
        <TypeBadge type={sim.type} />
        <DifficultyBadge level={sim.difficulty} />
      </div>

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
          {/* Clock icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {sim.time}
        </span>
        <Link
          href={`/simulate/${sim.id}`}
          className="text-sm font-medium text-teal hover:underline"
        >
          Start Simulation →
        </Link>
      </div>
    </div>
  );
}

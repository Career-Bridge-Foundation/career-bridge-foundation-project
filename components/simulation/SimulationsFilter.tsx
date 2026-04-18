"use client";

import { useState } from "react";
import { FilterBar } from "@/components/simulation/FilterBar";
import { SimulationCard } from "@/components/simulation/SimulationCard";
import type { Simulation } from "@/types/simulation";

interface Props {
  simulations: Simulation[];
}

export function SimulationsFilter({ simulations }: Props) {
  const [typeFilter, setTypeFilter] = useState("All");
  const [diffFilter, setDiffFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");

  const filtered = simulations.filter((s) => {
    if (typeFilter !== "All" && s.simulationType !== typeFilter) return false;
    if (diffFilter !== "All" && s.difficulty !== diffFilter) return false;
    if (industryFilter !== "All" && s.industry !== industryFilter) return false;
    return true;
  });

  const hasActiveFilter =
    typeFilter !== "All" || diffFilter !== "All" || industryFilter !== "All";

  function clearFilters() {
    setTypeFilter("All");
    setDiffFilter("All");
    setIndustryFilter("All");
  }

  return (
    <>
      <FilterBar
        typeFilter={typeFilter}
        diffFilter={diffFilter}
        industryFilter={industryFilter}
        onTypeChange={setTypeFilter}
        onDiffChange={setDiffFilter}
        onIndustryChange={setIndustryFilter}
        onClear={clearFilters}
        hasActiveFilter={hasActiveFilter}
      />

      <section className="px-6 py-16 bg-grey-bg">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-medium uppercase text-[#999] tracking-brand-sm mb-8">
            {filtered.length} simulation{filtered.length !== 1 ? "s" : ""} showing
          </p>

          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-base text-[#888]">No simulations match your filters.</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-sm font-medium text-teal"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border-light">
              {filtered.map((sim) => (
                <SimulationCard key={sim.id} simulation={sim} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

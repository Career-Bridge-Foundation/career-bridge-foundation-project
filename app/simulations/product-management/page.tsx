"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FilterBar } from "@/components/simulation/FilterBar";
import { SimulationCard } from "@/components/simulation/SimulationCard";
import { simulations } from "@/lib/simulations-data";

export default function ProductManagementPage() {
  const [typeFilter, setTypeFilter] = useState("All");
  const [diffFilter, setDiffFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");

  const filtered = simulations.filter((s) => {
    if (typeFilter !== "All" && s.type !== typeFilter) return false;
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
    <div className="min-h-screen">
      <Header />

      {/* ── PAGE HEADER ─────────────────────────────────────── */}
      <section className="relative px-6 pt-40 pb-20 bg-navy">
        <div className="hero-dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-teal" />
            <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
              Product Management
            </span>
          </div>
          <h1 className="font-bold text-white text-[clamp(2rem,4vw,3.25rem)] leading-hero mb-5">
            Build Your Product Management Portfolio
          </h1>
          <p className="text-base font-light text-white/70 leading-[1.75] mb-8 max-w-xl">
            Browse multiple Product Management workplace simulations, each designed around real
            industry scenarios and verified by experienced practitioners and product managers.
            Filter by scenario type, difficulty, or industry and start building evidence of your
            capability today.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="text-xs font-medium uppercase px-4 py-2 border border-teal text-teal tracking-brand-sm">
              Industry Recognised Capabilities
            </span>
            <span className="text-xs font-medium uppercase px-4 py-2 border border-white/30 text-white/70 tracking-brand-sm">
              Difficulty: Foundation to Advanced
            </span>
          </div>
        </div>
      </section>

      {/* ── FILTER BAR ──────────────────────────────────────── */}
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

      {/* ── SIMULATIONS GRID ────────────────────────────────── */}
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

      <Footer />
    </div>
  );
}

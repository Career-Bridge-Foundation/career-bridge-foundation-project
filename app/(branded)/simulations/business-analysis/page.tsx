"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FilterBar } from "@/components/simulation/FilterBar";
import { SimulationCard } from "@/components/simulation/SimulationCard";
import { createClient } from "@/lib/supabase/client";
import { checkSimulationAccess } from "@/lib/access-control";

type SimulationListItem = {
  id: string | number;
  slug: string;
  title: string;
  company: string;
  industry: string;
  type: string;
  difficulty: "Foundation" | "Practitioner" | "Advanced";
  time: string;
  description: string;
  simulation_uuid?: string;
  simulation_type?: string;
};

// Canonical tier order — never sort difficulty alphabetically, that yields
// Advanced / Foundation / Practitioner.
const DIFFICULTY_ORDER: SimulationListItem["difficulty"][] = [
  "Foundation",
  "Practitioner",
  "Advanced",
];

export default function BusinessAnalysisPage() {
  const [typeFilter, setTypeFilter] = useState("All");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    async function fetchAccess() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHasAccess(false); return; }
      const { hasAccess } = await checkSimulationAccess(user.id, "business-analysis");
      setHasAccess(hasAccess);
    }
    fetchAccess();
  }, []);
  const [diffFilter, setDiffFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");

  const [simsList, setSimsList] = useState<SimulationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(()=>{
    async function load(){
      const supabase = createClient();
      const { data, error } = await supabase
        .from('simulations_catalog')
        .select('*')
        .eq('discipline', 'business-analysis')
        .eq('status', 'published')
        .order('display_order', { ascending: true });

      if (error) {
        console.error("Error fetching simulations:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
      }

      // simulations_catalog is a straight SELECT off simulations (same id,
      // same slug), so simulation_type/id can be read directly off this row
      // — no second slug-matching query needed.
      const list: SimulationListItem[] = (data ?? []).map((s) => ({
        ...s,
        simulation_uuid: s.id,
        simulation_type: s.simulation_type ?? 'assessed',
      }));

      setSimsList(list);
      setIsLoading(false);
    }
    load();
  },[])

  // Filter options are derived from the rows actually returned, not hardcoded.
  // Business Analysis ships Foundation-only, so offering Practitioner/Advanced
  // would drop a newly granted candidate onto an empty grid.
  const typeOptions = useMemo(
    () => ["All", ...Array.from(new Set(simsList.map((s) => s.type))).sort()],
    [simsList]
  );
  // Tiers actually present in the returned rows, in canonical order. Feeds both
  // the Difficulty filter options and the hero badge, so the two cannot drift.
  const presentTiers = useMemo(() => {
    const present = new Set(simsList.map((s) => s.difficulty));
    return DIFFICULTY_ORDER.filter((d) => present.has(d));
  }, [simsList]);
  const diffOptions = useMemo(() => ["All", ...presentTiers], [presentTiers]);

  // "Difficulty: Foundation" for a single tier, "Difficulty: <lowest> to
  // <highest>" for a range. Updates itself when new tiers are published, so the
  // badge never needs a copy change.
  const difficultyLabel = useMemo(() => {
    if (presentTiers.length === 0) return null;
    if (presentTiers.length === 1) return `Difficulty: ${presentTiers[0]}`;
    return `Difficulty: ${presentTiers[0]} to ${presentTiers[presentTiers.length - 1]}`;
  }, [presentTiers]);
  const industryOptions = useMemo(
    () => ["All", ...Array.from(new Set(simsList.map((s) => s.industry))).sort()],
    [simsList]
  );

  const filtered = simsList.filter((s) => {
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
              Business Analysis
            </span>
          </div>
          <h1 className="font-bold text-white text-[clamp(2rem,4vw,3.25rem)] leading-hero mb-5">
            Build Your Business Analysis Portfolio
          </h1>
          <p className="text-base font-light text-white/70 leading-[1.75] mb-8 max-w-xl">
            Complete realistic business analysis simulations and earn a verified credential
            backed by evidence of what you actually did. Each simulation puts you inside a real
            organisation with real constraints — a sponsor who has already chosen the solution,
            a policy nobody follows, a requirements list that was never a specification. You are
            assessed on the judgement you show, not on how much you write. Built for business
            analysts, product owners and anyone whose job is to work out what the problem
            actually is.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="text-xs font-medium uppercase px-4 py-2 border border-teal text-teal tracking-brand-sm">
              Industry Recognised Capabilities
            </span>
            {!isLoading && difficultyLabel && (
              <span className="text-xs font-medium uppercase px-4 py-2 border border-white/30 text-white/70 tracking-brand-sm">
                {difficultyLabel}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── FILTER BAR ──────────────────────────────────────── */}
      {/* Held back until the rows land, otherwise the derived options would
          render as "All"-only and then visibly pop. */}
      {!isLoading && (
        <FilterBar
          typeFilter={typeFilter}
          diffFilter={diffFilter}
          industryFilter={industryFilter}
          onTypeChange={setTypeFilter}
          onDiffChange={setDiffFilter}
          onIndustryChange={setIndustryFilter}
          onClear={clearFilters}
          hasActiveFilter={hasActiveFilter}
          typeOptions={typeOptions}
          diffOptions={diffOptions}
          industryOptions={industryOptions}
        />
      )}

      {/* ── SIMULATIONS GRID ────────────────────────────────── */}
      <section className="px-6 py-16 bg-grey-bg">
        <div className="max-w-6xl mx-auto">
          {!isLoading && (
            <p className="text-xs font-medium uppercase text-[#999] tracking-brand-sm mb-8">
              {filtered.length} simulation{filtered.length !== 1 ? "s" : ""} showing
            </p>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border-light">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white p-8 flex flex-col gap-4 animate-pulse">
                  <div className="flex gap-2 mb-1">
                    <div className="h-4 w-20 bg-[#e8edf3] rounded-sm" />
                    <div className="h-4 w-16 bg-[#e8edf3] rounded-sm" />
                  </div>
                  <div className="h-5 w-3/4 bg-[#dce3ec] rounded-sm" />
                  <div className="h-4 w-1/2 bg-[#e8edf3] rounded-sm" />
                  <div className="space-y-2 mt-1">
                    <div className="h-3 w-full bg-[#eef1f5] rounded-sm" />
                    <div className="h-3 w-5/6 bg-[#eef1f5] rounded-sm" />
                    <div className="h-3 w-4/6 bg-[#eef1f5] rounded-sm" />
                  </div>
                  <div className="mt-auto pt-4 flex justify-between items-center">
                    <div className="h-4 w-24 bg-[#e8edf3] rounded-sm" />
                    <div className="h-8 w-28 bg-[#dce3ec] rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
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
                <SimulationCard key={sim.id} simulation={sim} hasAccess={hasAccess} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

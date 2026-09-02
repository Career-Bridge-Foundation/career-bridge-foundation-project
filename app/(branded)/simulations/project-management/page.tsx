"use client";

import { useState, useEffect } from "react";
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

export default function ProjectManagementPage() {
  const [typeFilter, setTypeFilter] = useState("All");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    async function fetchAccess() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHasAccess(false); return; }
      const { hasAccess } = await checkSimulationAccess(user.id, "project-management");
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
        .eq('discipline', 'project-management')
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
              Project Management
            </span>
          </div>
          <h1 className="font-bold text-white text-[clamp(2rem,4vw,3.25rem)] leading-hero mb-5">
            Build Your Project Management Portfolio
          </h1>
          <p className="text-base font-light text-white/70 leading-[1.75] mb-8 max-w-xl">
            Browse Project Management workplace simulations, each designed around real
            industry scenarios and verified by experienced practitioners and project managers.
            Filter by scenario type, difficulty, or industry and start building evidence of your
            capability today.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="text-xs font-medium uppercase px-4 py-2 border border-teal text-teal tracking-brand-sm">
              Industry Recognised Capabilities
            </span>
            <span className="text-xs font-medium uppercase px-4 py-2 border border-white/30 text-white/70 tracking-brand-sm">
              Difficulty: Foundation
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

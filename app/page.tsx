import Navbar from "@/components/layout/Navbar";
import SimulationCard from "@/components/home/SimulationCard";
import { getSimulation } from "@/lib/data/simulations";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Career Bridge Foundation — Portfolio Simulations",
  description:
    "Prove your capability through realistic, scenario-based assessments built for early-career professionals.",
};

const SIMULATION_IDS = ["nexus-bank-pm-v1"];

export default function Home() {
  const simulations = SIMULATION_IDS.flatMap((id) => {
    const sim = getSimulation(id);
    if (!sim) return [];
    return [sim];
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="bg-brand-primary">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-accent mb-4">
                Career Bridge Foundation
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5">
                Prove your skills.
                <br />
                Earn your credential.
              </h1>
              <p className="text-lg text-white/75 leading-relaxed">
                Portfolio simulations put you inside a real role at a real
                company. Work through genuine challenges, submit your thinking,
                and walk away with a verified credential that shows what you can
                actually do — not just what you studied.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-8 mt-12 pt-10 border-t border-white/15">
              {[
                {
                  value: "Real briefs",
                  label: "Built from actual industry scenarios",
                },
                {
                  value: "Verified credentials",
                  label: "Issued on successful completion",
                },
                { value: "60–90 min", label: "Average time to complete" },
              ].map((stat) => (
                <div key={stat.value}>
                  <p className="text-xl font-semibold text-white">
                    {stat.value}
                  </p>
                  <p className="text-sm text-white/60 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Simulations ───────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary">
              Available simulations
            </h2>
            <p className="text-text-muted mt-1.5">
              Select a simulation, read the brief, and begin when you&apos;re
              ready. Each one is self-contained and takes under two hours.
            </p>
          </div>

          {simulations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {simulations.map((sim) => (
                <SimulationCard
                  key={sim.id}
                  id={sim.id}
                  title={sim.title}
                  discipline={sim.discipline}
                  company={sim.company}
                  industry={sim.industry}
                  candidateRole={sim.candidateRole}
                  estimatedMinutes={sim.estimatedMinutes}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-white px-8 py-12 text-center">
              <p className="text-text-muted text-sm">
                No simulations available yet. Check back soon.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} Career Bridge Foundation. All
            simulations are fictional and created for assessment purposes only.
          </p>
        </div>
      </footer>
    </div>
  );
}

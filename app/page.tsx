import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SimulationCard from "@/components/home/SimulationCard";
import type { Metadata } from "next";
import type { Simulation } from "@/lib/types";


export const metadata: Metadata = {
  title: "Career Bridge Foundation — Portfolio Simulations",
  description:
    "Prove your capability through realistic, scenario-based assessments built for early-career professionals.",
};

export default async function Home() {
  let simulations: Simulation[] = [];

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/simulations`, {
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      simulations = json.simulations || [];
    }
  } catch (error) {
    console.error("Failed to fetch simulations:", error);
  }

  return (
    <div className="min-h-screen bg-warm-white flex flex-col">
      <Navbar />

      <main className="flex-1 pt-16">

        {/* ── Hero — dark ink section, matches reference site ──── */}
        <section className="cb-hero cb-dot-pattern">
          <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8 sm:py-28">
            <div className="max-w-3xl">

              {/* Eyebrow */}
              <div className="cb-eyebrow">
                <span className="cb-eyebrow-text">Workforce Activation Infrastructure</span>
              </div>

              {/* Heading */}
              <h1 className="text-white mb-6">
                Prove your skills.
                <br />
                <span className="text-accent-teal">Earn your credential.</span>
              </h1>

              {/* Body */}
              <p className="text-[rgba(250,250,249,0.6)] text-lg leading-relaxed mb-10 max-w-2xl">
                Portfolio simulations put you inside a real role at a real
                company. Work through genuine challenges, submit your thinking,
                and walk away with a verified credential that shows what you can
                actually do — not just what you studied.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-4">
                <a href="#simulations" className="cb-btn cb-btn-primary">
                  Apply to the Pathway
                </a>
                <a href="#simulations" className="cb-btn cb-btn-secondary">
                  Partner with Career Bridge
                </a>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-10 mt-16 pt-10 border-t border-[rgba(250,250,249,0.05)]">
              {[
                {
                  value: "Real briefs",
                  label: "Built from actual industry scenarios",
                },
                {
                  value: "Verified credentials",
                  label: "Issued on successful completion",
                },
              ].map((stat) => (
                <div key={stat.value}>
                  <p className="text-xl font-semibold text-warm-white">{stat.value}</p>
                  <p className="text-sm text-cool mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Simulations ───────────────────────────────────────── */}
        <section
          id="simulations"
          className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8"
        >
          {/* Section header */}
          <div className="mb-10">
            <div className="cb-eyebrow">
              <span className="cb-eyebrow-text">Available Now</span>
            </div>
            <h2 className="text-ink text-2xl sm:text-3xl font-semibold mb-3">
              Available simulations
            </h2>
            <p className="text-cool text-base max-w-xl">
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
                  company_name={sim.company_name}
                  industry={sim.industry}
                  candidate_role={sim.candidate_role}
                  estimated_minutes={sim.estimated_minutes}
                />
              ))}
            </div>
          ) : (
            <div className="border border-subtle bg-warm-white px-8 py-12 text-center">
              <p className="text-cool text-sm">
                No simulations available yet. Check back soon.
              </p>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

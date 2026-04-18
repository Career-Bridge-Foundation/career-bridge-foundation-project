import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SimulationsFilter } from "@/components/simulation/SimulationsFilter";
import { getSimulations } from "@/lib/requests";

export default async function ProductManagementPage() {
  const simulations = await getSimulations();

  // console.log("The Simulations2: ", simulations)

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

      <SimulationsFilter simulations={simulations} />

      <Footer />
    </div>
  );
}

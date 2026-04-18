import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DisciplineCard } from "@/components/simulation/DisciplineCard";
import { getDisciplines } from "@/lib/requests";
import type { Discipline as CardDiscipline } from "@/types";

export default async function SimulationsPage() {
  const disciplines = await getDisciplines();
  const disciplineCards: CardDiscipline[] = disciplines.map((discipline) => ({
    id: String(discipline.id),
    name: discipline.name,
    slug: discipline.slug,
    description: discipline.description,
    status: discipline.status,
    count: discipline.count ?? null,
    href: `/simulations?discipline=${discipline.slug}`,
  }));

  return (
    <div className="min-h-screen">
      <Header />

      {/* ── PAGE HEADER ─────────────────────────────────────── */}
      <section className="relative px-6 pt-40 pb-24 bg-navy">
        <div className="hero-dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-teal" />
            <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
              Career Bridge Portfolio Simulations
            </span>
          </div>
          <h1 className="font-bold text-white text-[clamp(2rem,4vw,3.25rem)] leading-hero mb-5">
            Choose Your Discipline
          </h1>
          <p className="text-base font-light text-white/70 leading-[1.75] md:whitespace-nowrap">
            Select a discipline, browse real industry simulations, and build verified portfolio
            evidence for employers.
          </p>
        </div>
      </section>

      {/* ── DISCIPLINES GRID ────────────────────────────────── */}
      <section className="px-6 py-20 bg-grey-bg">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-navy mb-12">
            Prove Your Capabilities by Job Role
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border-light">
            {disciplineCards.map((discipline) => (
              <DisciplineCard key={discipline.id} discipline={discipline} />
            ))}
          </div>
        </div>
      </section>

      {/* ── DON'T SEE YOUR DISCIPLINE ───────────────────────── */}
      <section className="py-24 px-6 text-center bg-navy">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-heading">
            Don&apos;t see your discipline?
          </h2>
          <p className="text-base font-light text-white/[0.68] leading-[1.8]">
            We are constantly expanding our simulation library. Get notified when new disciplines
            launch.
          </p>
          <a
            href="#"
            className="btn-apply-inverted text-xs font-medium uppercase px-7 py-3.5 mt-2"
          >
            Join the Waitlist
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}

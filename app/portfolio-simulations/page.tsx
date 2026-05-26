import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Portfolio Simulations — Career Bridge Foundation",
  description:
    "Portfolio simulations are the work, not a course about the work. Real scenarios, expert-validated rubrics, a verified work portfolio you own and share. From Career Bridge Foundation.",
};

const WHY_ITEMS = [
  {
    title: "They mirror the work, not a syllabus.",
    body: "Courses teach you what someone thinks you should know. Simulations test what you can actually do when nobody's giving you the answer. Employers don't hire based on what you've studied. They hire based on what you can produce. Portfolio simulations produce exactly that.",
  },
  {
    title: "They're assessed by experts, not just AI.",
    body: "The scoring rubric is designed and validated by named senior practitioners in the field. AI scores against the rubric at scale, but the rubric is the source of truth — and the rubric is human, expert-grade, and credible. The named-expert validation is what makes the credential mean something.",
  },
  {
    title: "They produce something you keep.",
    body: "You walk away with the actual artefacts you produced — work you can show a hiring manager, attach to a job application, or share on your professional profile. The credential confirms the assessment took place. The portfolio is the evidence. You own both.",
  },
];

const WHAT_CB_ADDS = [
  {
    title: "Named senior practitioners behind every rubric.",
    body: "The rubric is the standard your work is measured against. Career Bridge contracts senior practitioners with backgrounds in defence intelligence, regulated industries, and named institutional roles to design and validate every rubric. Their names appear on your portfolio. They are accountable for the standard. That's the trust layer no AI tool alone can offer.",
  },
  {
    title: "Alignment with national professional frameworks.",
    body: "Where a recognised career framework exists for a discipline, Career Bridge aligns to it. Cyber pathways are designed in alignment with the UK Cyber Security Council's Cyber Career Framework. This is the institutional grounding that distinguishes a Career Bridge portfolio from a self-built one.",
  },
  {
    title: "Office hours with the consultants who designed the rubric.",
    body: "Every sprint includes two 60-minute consultant-led office hours sessions. Not to teach you the subject matter. Not to give you the answers. To clarify scenario context, pressure-test your thinking, and let you talk through a judgement call with someone who has done the work professionally. Optional. Drop in when useful.",
  },
  {
    title: "A verified, shareable portfolio bundle.",
    body: "At the end of the sprint you receive your work artefacts, your rubric scores with assessor commentary, the named-expert validation block, and a digital credential issued via Certifier — bundled together as a portfolio you can share with employers, post on LinkedIn, and reference in interviews. We do the assembly so you can do the work.",
  },
  {
    title: "A community of candidates and coach-partners.",
    body: "Career Bridge runs sprints in cohorts. You go through the experience alongside other candidates. Coach-partners — career mentors, bootcamp instructors, independent practitioners — sit alongside the cohort to support candidates outside the platform itself. The community is part of the experience.",
  },
  {
    title: "A social enterprise mission.",
    body: "Career Bridge Foundation exists to close the workforce capability gap for people without traditional credentials. Every portfolio sold helps fund the wider mission: future grant-backed beneficiary programmes for candidates who can't pay, university and industry partnerships, and free pathways for under-represented entrants to in-demand fields.",
  },
];

const COMING_SOON = [
  { name: "Incident Response", when: "planned launch month 5" },
  { name: "Cyber Security Management", when: "planned later in 2026" },
  { name: "Cyber Security Governance & Risk Management", when: "planned later in 2026" },
];

export default function PortfolioSimulationsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative px-6 pt-40 pb-28 bg-navy">
        <div className="hero-dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-teal" />
            <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
              How Career Bridge works
            </span>
          </div>
          <h1 className="font-bold text-white text-[clamp(2rem,4vw,3.25rem)] leading-hero mb-5">
            Portfolio Simulations
          </h1>
          <p className="text-lg md:text-xl font-light text-white/80 mb-8 max-w-xl">
            The work, not a course about the work.
          </p>
          <p className="text-base font-light text-white/65 leading-[1.8] max-w-2xl">
            A portfolio simulation puts you in a realistic version of the job and asks you to
            produce the work the job actually produces. Not a quiz. Not a test of theory. Not a
            final assignment after weeks of teaching. The work itself — written assessments,
            decision logs, briefings, recommendations — the kind of artefact a hiring manager
            would ask to see.
          </p>
        </div>
      </section>

      {/* ── SECTION 1: HOW IT WORKS ──────────────────────────── */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-teal" />
            <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
              The process
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-8">
            How a portfolio simulation works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <p className="text-base text-[#555] leading-[1.85]">
              Each simulation is built around a specific scenario you&apos;d plausibly face in the
              role. You read a brief. You ask the questions you&apos;d ask. You make the calls
              you&apos;d make. You produce what the role requires. Then your work is scored against
              a rubric designed by senior practitioners in that field — the same people whose
              judgement employers already trust.
            </p>
            <div className="bg-grey-bg border border-border-light p-8">
              <p className="text-xs font-semibold uppercase text-teal tracking-brand-md mb-5">
                What you walk away with
              </p>
              <ul className="flex flex-col gap-4">
                {[
                  "Your work artefacts — exactly what you produced",
                  "Rubric scores with named-expert assessor commentary",
                  "A digital credential confirming you met the bar",
                  "A verified portfolio bundle you own and share",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-navy leading-[1.7]">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-[#666] leading-[1.75]">
                A certificate says you finished something. A portfolio shows what you can do.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: WHY THEY WORK ─────────────────────────── */}
      <section className="bg-grey-bg py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-teal" />
            <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
              Why it matters
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-12">
            Why portfolio simulations work
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border-light">
            {WHY_ITEMS.map(({ title, body }) => (
              <div key={title} className="relative bg-white p-10 flex flex-col">
                <div className="absolute top-8 right-8 w-2 h-2 rounded-full bg-teal" />
                <h3 className="text-base font-bold text-navy leading-[1.4] mb-4">{title}</h3>
                <p className="text-sm text-[#666] leading-[1.75] flex-1">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: WHAT IT ISN'T ─────────────────────────── */}
      <section className="bg-navy py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-teal" />
            <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
              Clarity
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-heading mb-10">
            What a portfolio simulation isn&apos;t
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: "Not a course.",
                desc: "There's no curriculum, no instructor delivering content, no lectures.",
              },
              {
                label: "Not a multiple-choice test.",
                desc: "The work is real and open-ended — there's no single right answer to tick.",
              },
              {
                label: "Not a guaranteed pass.",
                desc: "If your work doesn't meet the bar, you keep the artefacts and the feedback but the credential isn't issued. That's what makes it credible.",
              },
            ].map(({ label, desc }) => (
              <div key={label} className="border border-white/15 p-8">
                <p className="text-sm font-bold text-teal mb-3">{label}</p>
                <p className="text-sm font-light text-white/70 leading-[1.75]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: WHAT CAREER BRIDGE ADDS ──────────────── */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-teal" />
            <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
              The Career Bridge difference
            </span>
          </div>
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-5">
              What Career Bridge adds
            </h2>
            <p className="text-base text-[#555] leading-[1.85]">
              Portfolio simulations could in principle run on any platform. What Career Bridge adds
              is the layer that makes the portfolio meaningful — and the reason candidates choose to
              do their portfolio work here rather than anywhere else.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-light">
            {WHAT_CB_ADDS.map(({ title, body }) => (
              <div key={title} className="relative bg-white p-10">
                <div className="absolute top-8 right-8 w-2 h-2 rounded-full bg-teal" />
                <h3 className="text-sm font-bold text-navy mb-3 leading-[1.4] pr-6">{title}</h3>
                <p className="text-sm text-[#666] leading-[1.75]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: AVAILABLE PATHWAYS ────────────────────── */}
      <section className="bg-grey-bg py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-teal" />
            <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
              Pathways
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-4">
            Available pathways
          </h2>
          <p className="text-base text-[#555] leading-[1.8] mb-14 max-w-2xl">
            Career Bridge launches new portfolio simulation pathways through 2026, one discipline
            at a time. Each pathway maps to roles with strong employer demand and a credible
            professional framework.
          </p>

          {/* Available now */}
          <div className="mb-12">
            <p className="text-xs font-semibold uppercase text-teal tracking-brand-md mb-6">
              Available now
            </p>
            <div className="border border-border-light bg-white p-8 md:p-10 flex flex-col md:flex-row md:items-start md:justify-between gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-2 h-2 rounded-full bg-teal shrink-0" />
                  <h3 className="text-lg font-bold text-navy">Cyber Threat Intelligence</h3>
                </div>
                <p className="text-sm text-[#666] leading-[1.8] mb-4 max-w-xl">
                  A two-week portfolio simulation in cyber threat intelligence work.
                  Scenario-based simulations, expert-validated rubrics, named-consultant
                  assessment, digital credential. Aligned to the UK Cyber Security Council&apos;s
                  Cyber Career Framework.
                </p>
                <p className="text-xs text-navy/50 uppercase tracking-brand-sm font-medium">
                  UK Cyber Security Council · Cyber Career Framework
                </p>
              </div>
              <a
                href="/simulations"
                className="btn-apply shrink-0 inline-flex items-center gap-2 text-xs font-medium uppercase px-7 py-3.5 whitespace-nowrap self-start"
              >
                Explore the pathway
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>

          {/* Coming soon */}
          <div>
            <p className="text-xs font-semibold uppercase text-navy/50 tracking-brand-md mb-6">
              Opening through 2026
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border-light">
              {COMING_SOON.map(({ name, when }) => (
                <div key={name} className="bg-white p-8 flex flex-col gap-3">
                  <span className="w-2 h-2 rounded-full bg-navy/20 shrink-0" />
                  <p className="text-sm font-bold text-navy">{name}</p>
                  <p className="text-xs text-[#999] uppercase tracking-brand-sm">{when}</p>
                </div>
              ))}
              <div className="bg-white p-8 flex flex-col gap-3 justify-center">
                <p className="text-xs text-[#999] leading-[1.7]">
                  Further disciplines in regulated industries to follow.
                </p>
              </div>
            </div>
            <p className="mt-8 text-sm text-[#666] leading-[1.75]">
              Pathway list expands as new disciplines open.{" "}
              <a href="/auth/signup" className="text-teal hover:underline font-medium">
                Join the mailing list →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: CLOSING CTA ───────────────────────────── */}
      <section className="bg-navy py-28 px-6 text-center">
        <div className="hero-dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative max-w-xl mx-auto flex flex-col items-center gap-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-heading">
            Ready to see what a portfolio simulation looks like?
          </h2>
          <p className="text-base font-light text-white/[0.68] leading-[1.8]">
            The Cyber Threat Intelligence pathway is open now, with founding cohort places
            available at a launch price.
          </p>
          <a
            href="/simulations"
            className="btn-hero-primary inline-flex items-center gap-2 text-xs font-medium uppercase px-8 py-4 mt-2"
          >
            Explore the Verified Cyber Threat Intelligence Work Portfolio
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <p className="text-xs text-white/35 uppercase tracking-brand-sm mt-2">
            Powered by Evidentize · Aligned to the UK Cyber Security Council Cyber Career Framework
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}

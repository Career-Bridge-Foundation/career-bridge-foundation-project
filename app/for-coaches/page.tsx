"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const NAVY = "#003359";
const TEAL = "#4DC5D2";
const BLUE = "#006FAD";

// ── Shared sub-components ─────────────────────────────────────

function Check() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="shrink-0 mt-0.5"
    >
      <circle cx="9" cy="9" r="9" fill={TEAL} opacity="0.15" />
      <path
        d="M5 9.5l2.8 2.8 5-5.6"
        stroke={TEAL}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── FAQ accordion item ────────────────────────────────────────

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="font-semibold text-base" style={{ color: NAVY }}>
          {q}
        </span>
        <span
          className="text-2xl font-light leading-none shrink-0 transition-transform duration-200"
          style={{ color: TEAL, transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          +
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "400px" : "0px" }}
      >
        <p className="pb-5 text-sm text-gray-600 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function ForCoachesPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Smooth scroll for all anchor links on this page
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  async function handleGetStarted() {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType: "coach" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setCheckoutLoading(false);
    }
  }

  const faqs = [
    {
      q: "How many simulations can I assign to each candidate?",
      a: "There is no limit. You can assign as many simulations as you want to each candidate — within one discipline, across multiple disciplines, or a custom mix. Each candidate can work through Product Management, Cyber Security, Project Management, and more, all from the same account.",
    },
    {
      q: "What disciplines and simulations are available?",
      a: "We currently offer simulations across Product Management, Project Management, Cyber Security, Cloud DevOps, and Customer Service. Each discipline contains multiple scenario-based simulations set in realistic fictional companies. New simulations are added regularly.",
    },
    {
      q: "How does the AI evaluation actually work?",
      a: "Each simulation contains 5 tasks. Every task is evaluated against 3 criteria using a structured rubric with weak, competent, and strong descriptors — that is 15 criteria per simulation. The AI produces a detailed feedback report with scores per criterion and an overall verdict band: Distinction, Merit, Pass, Borderline, or Did Not Pass. Coaches can review the full evaluation alongside the candidate's original responses.",
    },
    {
      q: "Can I review my candidates' work and add my own feedback?",
      a: "Yes. The co-review mode shows you three panels side by side: the candidate's submitted responses, the AI evaluation with scores and rubric breakdowns, and a notes panel where you can write your own observations. Your notes are private by default — you choose whether to share them with the candidate.",
    },
    {
      q: "What are the digital credentials and how do they work?",
      a: "Candidates who pass receive a verified digital credential issued via Certifier. These credentials include the candidate's name, the simulation completed, the verdict band, and a unique verification URL. Candidates can share them on LinkedIn, embed them in portfolios, or include them in job applications. Employers can verify them independently with one click.",
    },
    {
      q: "Can I issue credentials in bulk for my whole cohort?",
      a: "Yes. You can select multiple candidates from your dashboard and issue credentials in one action. The system will issue credentials for all candidates with passing results and flag any that did not meet the threshold.",
    },
    {
      q: "What reporting is available for stakeholders?",
      a: "You can export a cohort report as PDF or CSV containing per-candidate scores, completion rates, verdict bands, credential statuses, and aggregate statistics. This is designed for funder reporting, board presentations, and programme reviews.",
    },
    {
      q: "What if I need more than 10 candidate seats?",
      a: "Contact us at outreach@careerbridgefoundation.com for custom pricing on larger cohorts. We work with training providers running programmes of 20, 50, and 100+ candidates.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Header variant="solid" />

      <main className="flex-1">

        {/* ── SECTION 1: Hero ─────────────────────────────────── */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-24 bg-gray-50 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left: copy */}
              <div className="flex flex-col gap-6">
                <div
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest w-fit px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: `${TEAL}20`, color: TEAL }}
                >
                  TRAINING PROVIDERS • COACHES • PROGRAMME LEADERS
                </div>

                <h1
                  className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
                  style={{ color: NAVY, lineHeight: 1.1 }}
                >
                  Turn Your Programme Into a Talent Pipeline
                </h1>

                <p className="text-lg text-gray-500 leading-relaxed max-w-xl">
                  Give your candidates workplace simulations that build real evidence. Track their progress, co-review AI evaluations, and issue verified credentials — all from one platform.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mt-2">
                  <a
                    href="#pricing"
                    className="inline-flex items-center justify-center px-8 py-4 rounded-lg text-base font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: NAVY }}
                  >
                    Get Started with a Coach Pack
                  </a>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center gap-2 px-4 py-4 text-base font-semibold transition-opacity hover:opacity-70"
                    style={{ color: TEAL }}
                  >
                    See How It Works
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Right: mockup dashboard card */}
              <div className="flex justify-center lg:justify-end">
                <div
                  className="w-full max-w-sm bg-white rounded-2xl p-6 flex flex-col gap-4"
                  style={{ boxShadow: "0 8px 40px 0 rgba(0,51,89,0.12), 0 2px 8px 0 rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold" style={{ color: NAVY }}>Your Cohort</span>
                    <span className="text-xs text-gray-400">September Intake</span>
                  </div>

                  {/* Candidate rows */}
                  {[
                    { name: "Amara O.", progress: 100, status: "Completed", statusColor: "#16A34A", statusBg: "#DCFCE7" },
                    { name: "James K.", progress: 60, status: "In Progress", statusColor: BLUE, statusBg: "#DBEAFE" },
                    { name: "Priya S.", progress: 0, status: "Not Started", statusColor: "#6B7280", statusBg: "#F3F4F6" },
                  ].map((c) => (
                    <div key={c.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{c.name}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: c.statusColor, backgroundColor: c.statusBg }}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${c.progress}%`, backgroundColor: TEAL }}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400">4 of 10 seats used</span>
                    <div className="flex gap-1">
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: i < 4 ? TEAL : "#E5E7EB" }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── SECTION 2: Before/After Contrast ────────────────── */}
        <section id="problems" className="py-16 md:py-24 bg-white px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold" style={{ color: NAVY }}>
                The Gap Between Your Programme and Success
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Without Career Bridge */}
              <div
                className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-6"
                style={{ borderLeft: "4px solid #E74C3C" }}
              >
                <h3 className="text-xl font-bold" style={{ color: "#1a1a2e" }}>
                  Without Career Bridge
                </h3>
                <ul className="flex flex-col space-y-4">
                  {[
                    "Candidates leave with certificates that prove attendance, not ability",
                    "You track progress in spreadsheets, emails, and guesswork",
                    "Employers ignore your candidates because they have no portfolio evidence",
                    "You cannot prove to funders that your programme actually works",
                    "Every cohort feels like starting from scratch",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-base text-gray-600">
                      <span className="shrink-0 font-bold mt-0.5" style={{ color: "#E74C3C" }}>✗</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* With Career Bridge */}
              <div
                className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-6"
                style={{ borderLeft: `4px solid ${TEAL}` }}
              >
                <h3 className="text-xl font-bold" style={{ color: "#1a1a2e" }}>
                  With Career Bridge
                </h3>
                <ul className="flex flex-col space-y-4">
                  {[
                    "Candidates build verified portfolio evidence through realistic workplace simulations",
                    "You track every candidate's progress from one dashboard in real time",
                    "Candidates share AI-evaluated results and digital credentials with employers directly",
                    "You export cohort reports with completion rates, scores, and credential data for stakeholders",
                    "Every cohort runs on the same proven structure — assign, track, credential, repeat",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-base text-gray-600">
                      <span className="shrink-0 font-bold mt-0.5" style={{ color: TEAL }}>✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </section>

        {/* ── SECTION 3: How It Works ──────────────────────────── */}
        <section id="how-it-works" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: "#F5F5F5" }}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold" style={{ color: NAVY }}>
                Set Up in Minutes. See Results in Days.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  n: "1",
                  heading: "Purchase a Coach Pack",
                  text: "Get 10 candidate seats with full platform access across all disciplines.",
                },
                {
                  n: "2",
                  heading: "Invite Your Candidates",
                  text: "Send invite links. Candidates sign up and land in your cohort dashboard.",
                },
                {
                  n: "3",
                  heading: "Assign Simulations",
                  text: "Choose which workplace simulations your candidates complete — by discipline, scenario, or custom pathway.",
                },
                {
                  n: "4",
                  heading: "Track, Review, Credential",
                  text: "Monitor progress in real time. Co-review AI evaluations. Add coaching notes. Issue verified digital credentials in bulk.",
                },
              ].map((step) => (
                <div key={step.n} className="flex flex-col gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
                    style={{ backgroundColor: NAVY }}
                  >
                    {step.n}
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: NAVY }}>{step.heading}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 4: Feature Breakdown ────────────────────── */}
        <section id="features" className="py-16 md:py-24 bg-white px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold" style={{ color: NAVY }}>
                Built for Programme Operators, Not Just Individual Coaches
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Cohort Management */}
              <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-6 border border-gray-100">
                <div>
                  <h3 className="text-xl font-bold mb-1" style={{ color: NAVY }}>Cohort Management</h3>
                  <div className="h-0.5 w-12 rounded-full mt-2" style={{ backgroundColor: TEAL }} />
                </div>
                <ul className="flex flex-col gap-4">
                  {[
                    "Invite and manage up to 10 candidates per Coach Pack",
                    "View cohort-wide progress at a glance",
                    "See which simulations each candidate has started, submitted, or completed",
                    "Filter by discipline, simulation, or completion status",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                      <Check />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Evaluation & Credentialing */}
              <div className="bg-white rounded-xl shadow-md p-8 flex flex-col gap-6 border border-gray-100">
                <div>
                  <h3 className="text-xl font-bold mb-1" style={{ color: NAVY }}>Evaluation &amp; Credentialing</h3>
                  <div className="h-0.5 w-12 rounded-full mt-2" style={{ backgroundColor: TEAL }} />
                </div>
                <ul className="flex flex-col gap-4">
                  {[
                    "Access full AI evaluation reports for every candidate",
                    "Add coach notes and observations alongside AI feedback",
                    "Co-review mode: candidate responses, AI scores, and rubric breakdowns side by side",
                    "Issue verified digital credentials via Certifier — individually or in bulk",
                    "Exportable cohort reports for stakeholders",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                      <Check />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        </section>

        {/* ── SECTION 5: Social Proof ──────────────────────────── */}
        <section id="proof" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: NAVY }}>
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-14">
              Real Results. Real Candidates. Real Evidence.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

              {[
                {
                  quote: "Career Bridge has been a turning point in my career. The simulated work gave me the opportunity to apply agile principles in real projects, sharpen my coaching and facilitation skills, and accelerate my development in a way traditional learning never could.",
                  name: "Henry A.",
                  role: "SCRUM MASTER",
                },
                {
                  quote: "The simulated work experience had a real impact on my skills. I improved my time management, built my communication confidence, and worked across more formats and platforms than I ever had before. It changed how I show up professionally.",
                  name: "Olena A.",
                  role: "PRODUCT INTERACTION DESIGNER",
                },
                {
                  quote: "From day one I was trusted with real responsibilities. The hands-on experience I gained is something I would not trade for anything. It built my confidence, pushed me out of my comfort zone, and gave me practical skills no textbook could have taught me.",
                  name: "Sanyu S.",
                  role: "HR AND PERFORMANCE ANALYST",
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col justify-between gap-6 p-8 rounded-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <div className="flex flex-col gap-4">
                    <span className="text-4xl font-serif leading-none" style={{ color: TEAL, opacity: 0.6 }}>&ldquo;</span>
                    <p className="text-base italic text-white leading-relaxed">{t.quote}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{t.name}</p>
                    <p className="text-xs uppercase tracking-wider" style={{ color: TEAL }}>{t.role}</p>
                  </div>
                </div>
              ))}

            </div>
          </div>
        </section>

        {/* ── SECTION 6: Pricing ──────────────────────────────── */}
        <section id="pricing" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: "#F5F5F5" }}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold" style={{ color: NAVY }}>
                One Pack. Full Access. 10 Candidates.
              </h2>
            </div>

            <div className="max-w-lg mx-auto">
              <div
                className="bg-white rounded-2xl p-10 flex flex-col gap-8"
                style={{ boxShadow: "0 8px 40px 0 rgba(0,51,89,0.12), 0 2px 8px 0 rgba(0,0,0,0.06)", borderTop: `3px solid ${TEAL}` }}
              >
                {/* Plan header */}
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Coach Pack</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-bold" style={{ color: NAVY }}>£1,499.99</span>
                  </div>
                  <p className="text-base text-gray-400">10 candidate seats</p>
                </div>

                <hr className="border-gray-200" />

                {/* Features */}
                <ul className="flex flex-col gap-4">
                  {[
                    "All simulations across all disciplines",
                    "Cohort dashboard with real-time progress",
                    "AI evaluations + coach co-review",
                    "Bulk credential issuance via Certifier",
                    "Access to Career Bridge community",
                    "Dedicated support",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-gray-600">
                      <Check />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleGetStarted}
                    disabled={checkoutLoading}
                    className="w-full py-4 rounded-lg text-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: NAVY }}
                  >
                    {checkoutLoading ? (
                      <>
                        <Spinner />
                        Processing…
                      </>
                    ) : (
                      "Get Started"
                    )}
                  </button>
                  {checkoutError && (
                    <p className="text-xs text-red-500 text-center">{checkoutError}</p>
                  )}
                  <p className="text-sm text-center text-gray-400">
                    Need more than 10 seats?{" "}
                    <a
                      href="mailto:outreach@careerbridgefoundation.com"
                      className="underline hover:opacity-80"
                      style={{ color: NAVY }}
                    >
                      Get in touch
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 7: FAQ ──────────────────────────────────── */}
        <section id="faq" className="py-16 md:py-24 bg-white px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" style={{ color: NAVY }}>
              Common Questions
            </h2>

            <div className="divide-y divide-gray-200 border-t border-gray-200">
              {faqs.map((item, i) => (
                <FaqItem
                  key={i}
                  q={item.q}
                  a={item.a}
                  open={faqOpen === i}
                  onToggle={() => setFaqOpen(faqOpen === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 8: Final CTA ─────────────────────────────── */}
        <section
          className="py-20 md:py-28 px-4 sm:px-6 lg:px-8"
          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}
        >
          <div className="max-w-3xl mx-auto text-center flex flex-col gap-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Ready to Give Your Candidates an Unfair Advantage?
            </h2>
            <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
              Start building verified candidate portfolios today.
            </p>
            <div className="flex flex-col items-center gap-4 mt-2">
              <a
                href="#pricing"
                className="inline-flex items-center justify-center px-8 py-4 rounded-lg text-lg font-semibold transition-colors hover:bg-gray-100"
                style={{ backgroundColor: "#ffffff", color: NAVY }}
              >
                Get Your Coach Pack
              </a>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

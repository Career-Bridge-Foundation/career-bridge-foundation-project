"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// ── Static data ───────────────────────────────────────────────

const PORTFOLIO_ITEMS = [
  {
    n: "1",
    title: "The artefacts you produced.",
    body: "The actual work — intelligence assessments, triage decision logs, analyst briefings — written by you, in response to scenarios designed to mirror real threat intelligence work. These are the pieces you put in front of a hiring manager when they ask to see your work.",
  },
  {
    n: "2",
    title: "Rubric scores on every competency.",
    body: "Your work is scored against a rubric covering the specific competencies cyber threat intelligence employers actually look for. You see exactly where you scored strongly, where you're developing, and where the gaps are. No mystery grades. No 'you passed.' Real, specific feedback.",
  },
  {
    n: "3",
    title: "Named-expert validation.",
    body: "The rubrics behind this portfolio were designed by senior practitioners with backgrounds in UK defence intelligence — people whose previous roles include intelligence leadership in the British Army and MoD-adjacent intelligence work. Their names appear on your portfolio. That's the trust layer.",
  },
  {
    n: "4",
    title: "A digital credential, issued via Certifier.",
    body: "A shareable, verifiable digital credential confirming you completed the portfolio and met the bar. Drops straight into LinkedIn, email signatures, and your portfolio site.",
  },
  {
    n: "5",
    title: "UK Cyber Security Council framework alignment.",
    body: "The portfolio is designed in alignment with the UK Cyber Security Council's Cyber Career Framework specialism in Cyber Threat Intelligence. That alignment is what gives the credential institutional grounding rather than being something we invented.",
  },
];

const TIMELINE = [
  {
    label: "Week 0 — Onboarding",
    sublabel: "The day after you enrol",
    body: "You receive your pack, your platform access, and your cohort window. You meet the other candidates in a private channel. We send the scenario briefs the day the cohort opens.",
  },
  {
    label: "Weeks 1 and 2 — The work",
    sublabel: null,
    body: "You work through 2–3 scenario-based simulations at your own pace within the two-week window. You produce real artefacts — written assessments, briefings, decision logs — in response to realistic intelligence scenarios. There is no instruction. No teaching. No lectures. The work is yours.",
  },
  {
    label: "During the cohort — Office hours",
    sublabel: "Optional",
    body: "Two 60-minute consultant-led office hours sessions during the cohort. Use them to clarify scenario context, pressure-test your thinking, or talk through a judgement call. The consultant does not give you answers. They sharpen your reasoning. Optional. Drop in if useful.",
  },
  {
    label: "End of week 2 — Assessment and portfolio delivery",
    sublabel: null,
    body: "Your work is scored against the expert-validated rubric. Your portfolio bundle — artefacts, rubric scores, assessor commentary, named-expert validation, digital credential — is issued at the end of the cohort.",
  },
];

const FOR_YOU = [
  "You've already done the learning — a course, a degree, self-study, a previous adjacent role — and you need to prove you can do the work.",
  "You're switching into cyber threat intelligence from an adjacent field and need a credible portfolio piece to show.",
  "You're early or mid-career in cyber and want to move up, with rubric scores that show employers exactly what you can do.",
  "You'd rather be assessed honestly than told you passed.",
  "You can commit two weeks of real focused work.",
];

const NOT_FOR_YOU = [
  "You're looking for someone to teach you cyber threat intelligence from scratch. This isn't a course — try a structured CTI programme first, then come back.",
  "You want a guaranteed pass or guaranteed job. We don't promise outcomes — we promise verified proof.",
  "You can't commit two weeks of focused effort in the next month.",
  "You want a fast certificate without doing the work.",
];

const FEATURES = [
  "All 2–3 scenarios",
  "Rubric-scored portfolio bundle",
  "Two consultant office hours",
  "Digital credential via Certifier",
  "Named-expert validation",
  "Closing feedback session with the Career Bridge team",
  "Founding cohort badge on your credential",
];

const FAQS = [
  {
    q: "Is this accredited?",
    a: "The portfolio is designed in alignment with the UK Cyber Security Council's Cyber Career Framework specialism in Cyber Threat Intelligence. It is not a formal academic qualification. It is a verified work portfolio, designed to be the thing employers ask for when they say \"show me your work.\"",
  },
  {
    q: "Will I get a job at the end?",
    a: "We do not promise jobs. We promise verified proof of capability. Outcomes — interviews, offers, promotions — depend on factors outside our control. What we give you is a portfolio you can put in front of a hiring manager that says, credibly, \"I can do this work.\"",
  },
  {
    q: "How is the work scored?",
    a: "Your artefacts are scored against the expert-designed rubric using a hybrid of AI-assisted scoring and expert review. The rubric is the source of truth. The named consultants who designed it are the trust layer. You receive your scores with assessor commentary at the end of the cohort.",
  },
  {
    q: "What if I don't pass?",
    a: "You still keep everything you produced. The portfolio is yours either way. If you don't meet the bar on a competency, your portfolio shows your scores honestly — and you can take the same cohort again at a discounted re-take rate. We don't issue the digital credential until you meet the bar, but the artefacts and feedback are yours regardless.",
  },
  {
    q: "Who are the named consultants?",
    a: "We name them with their written permission on this page once each one is confirmed. The current panel includes senior practitioners with backgrounds in UK defence intelligence — previous roles including intelligence leadership in the British Army and MoD-adjacent intelligence work.",
  },
  {
    q: "How much time will it take?",
    a: "The cohort runs over two weeks. We recommend candidates plan for 15–25 hours of focused work across that window. The format is self-paced — you can do it across two weekends and weekday evenings, or in concentrated blocks. There are no live mandatory sessions other than the optional office hours.",
  },
  {
    q: "What is Evidentize, and how is it related to Career Bridge?",
    a: "Evidentize is the technology platform that powers the Career Bridge portfolios. Career Bridge Foundation is the social enterprise that runs the cohorts and issues the credentials; Evidentize is the verification platform underneath. You're paying Career Bridge for the portfolio. The Evidentize mention is acknowledgement of the platform — the same way you'd see \"powered by Stripe\" on a checkout page.",
  },
  {
    q: "I also see Join Momentum mentioned. What's that?",
    a: "Join Momentum is a sister organisation that delivers cohort capability assessments for institutional buyers — defence agencies, government, large employers. It uses the same platform and the same rubrics. As a candidate, your relationship is with Career Bridge Foundation. Join Momentum is mentioned because the same senior practitioners design rubrics for both.",
  },
  {
    q: "How does the rubric scoring actually work? Is this just an AI grading me?",
    a: "No. The rubric — the standard your work is measured against — is designed and validated by named senior practitioners in cyber threat intelligence. AI assists with applying the rubric to your artefacts at scale, but the rubric itself is human, expert-grade. You can think of it as: the AI does the marking, but the named experts wrote the marking scheme and are accountable for it. Your rubric scores come back to you with assessor commentary where relevant.",
  },
  {
    q: "Why isn't there a course or training included?",
    a: "Because that's not the product. We sell verified proof of capability — the portfolio that comes from doing the work, not the teaching that comes before the work. If you need to learn cyber threat intelligence from scratch, take a structured CTI programme first; come back when you want to prove what you've learned. The portfolio work is genuinely difficult for someone with no prior exposure to CTI, and we'd rather be honest about that than take your money for a product that isn't going to help you.",
  },
  {
    q: "What if Career Bridge isn't a recognised body in cyber?",
    a: "Career Bridge Foundation is a UK-registered Community Interest Company. The portfolio is designed in alignment with the UK Cyber Security Council's Cyber Career Framework. We're an early-stage social enterprise. We're not pretending to be a major accrediting body. What we offer is something specific: a verified work portfolio designed by named senior practitioners, in alignment with the national career framework. The credibility is in the rubric design and the expert validation, not in the size of our organisation.",
  },
  {
    q: "I have a question that isn't here.",
    a: "Email support@careerbridgefoundation.zohodesk.eu and we'll respond within 48 hours.",
  },
];

// ── Sub-components ────────────────────────────────────────────

function TealDot() {
  return <span className="mt-1.5 w-2 h-2 rounded-full bg-teal shrink-0" />;
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 mt-1">
      <path d="M2 2l10 10M12 2L2 12" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 mt-1">
      <circle cx="7" cy="7" r="7" fill="#0d9488" opacity="0.15" />
      <path d="M3.5 7.5l2.5 2.5 4.5-5" stroke="#0d9488" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-px bg-teal" />
      <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">{children}</span>
    </div>
  );
}

function CtaButton({ className }: { className?: string }) {
  // TODO: wire to Stripe checkout once cti_founding PriceType is added to the DB and pricing lib
  function handleClick() {
    window.location.href = "/auth/signup?redirect=/portfolio-simulations/cyber-threat-intelligence";
  }
  return (
    <button
      onClick={handleClick}
      className={className}
    >
      Claim a founding cohort place · $299
    </button>
  );
}

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border-light last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left gap-6 group"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-navy leading-[1.5] flex-1">{q}</span>
        <span
          className="text-xl font-light text-teal shrink-0 transition-transform duration-200 leading-none"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "600px" : "0px" }}
      >
        <p className="pb-5 text-sm text-[#666] leading-[1.8]">{a}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function CtiPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative px-6 pt-40 pb-28 bg-navy">
        <div className="hero-dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto">

          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 border border-teal/40 bg-teal/10">
            <span className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
            <span className="text-xs font-medium text-teal tracking-brand-sm uppercase">
              Career Bridge Foundation · Founding cohort places at $299
            </span>
          </div>

          {/* H1 */}
          <h1 className="font-bold text-white text-[clamp(2rem,4vw,3.25rem)] leading-hero mb-6 max-w-3xl">
            Verified Cyber Threat Intelligence Work Portfolio
          </h1>

          {/* Subhead */}
          <p className="text-lg font-light text-white/75 leading-[1.75] max-w-2xl mb-10">
            Prove you can do the work. Two weeks of real scenarios, expert-validated rubrics,
            a portfolio you own and share.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <CtaButton className="btn-hero-primary inline-flex items-center gap-2 text-xs font-medium uppercase px-8 py-4 tracking-brand-xs" />
          </div>

          {/* Scarcity */}
          <p className="mt-5 text-sm font-light text-white/60">
            20 founding cohort places. After they&apos;re gone, the next cohort opens at $599.
          </p>

          {/* Trust line */}
          <p className="mt-4 text-xs text-white/35 uppercase tracking-brand-sm">
            Aligned to the UK Cyber Security Council Cyber Career Framework · Powered by Evidentize
          </p>
        </div>
      </section>

      {/* ── SECTION 1: WHAT THIS IS ──────────────────────────── */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionLabel>What this is, and what it isn&apos;t</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-10 max-w-2xl">
            You can already learn cyber threat intelligence.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="flex flex-col gap-6">
              <p className="text-base text-[#555] leading-[1.85]">
                There&apos;s no shortage of courses, certifications, and YouTube tutorials competing
                for your time and money.
              </p>
              <p className="text-base text-[#555] leading-[1.85]">
                What you can&apos;t easily get is proof.
              </p>
              <p className="text-base text-[#555] leading-[1.85]">
                Employers in cyber threat intelligence don&apos;t trust certificates the way they
                used to. The question they actually ask in interviews is some version of{" "}
                <em>
                  &ldquo;show me your work.&rdquo;
                </em>{" "}
                If you can&apos;t put a real intelligence assessment in front of them — produced
                under realistic conditions, assessed against a credible standard, signed off by
                someone whose name carries weight — you&apos;re in the same pile as everyone else.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <p className="text-base text-[#555] leading-[1.85]">
                The Verified Cyber Threat Intelligence Work Portfolio is the bit that comes after
                the learning. You do the work. We assess it. You walk away with a verified
                portfolio you actually own — the assessment artefacts, the rubric scores, the
                named-expert validation, and a digital credential confirming you met the bar.
              </p>
              <div className="border-l-2 border-teal pl-6">
                <p className="text-base font-medium text-navy leading-[1.75]">
                  It&apos;s two weeks. It&apos;s deliberately uncomfortable. It&apos;s the closest
                  thing to the job you&apos;ll find without already being in the job.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: WHAT YOU WALK AWAY WITH ──────────────── */}
      <section className="bg-grey-bg py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionLabel>Your portfolio</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-4">
            What you walk away with
          </h2>
          <p className="text-base text-[#666] mb-12 max-w-xl leading-[1.8]">
            Five things go into your portfolio. All five are yours to keep, share, and use.
          </p>

          <div className="flex flex-col gap-px bg-border-light">
            {PORTFOLIO_ITEMS.map(({ n, title, body }) => (
              <div key={n} className="relative bg-white p-8 md:p-10 flex gap-6 md:gap-8">
                <span className="text-xs font-semibold text-teal tracking-brand-xl shrink-0 mt-1 w-4">
                  {n}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-navy mb-2">{title}</h3>
                  <p className="text-sm text-[#666] leading-[1.8]">{body}</p>
                </div>
                <div className="absolute top-8 right-8 w-1.5 h-1.5 rounded-full bg-teal" />
              </div>
            ))}
          </div>

          {/* Placeholder: consultants section */}
          <div className="mt-8 border border-dashed border-border-light bg-white p-8">
            <p className="text-xs font-semibold uppercase text-navy/40 tracking-brand-md mb-2">
              Expert validation — placeholder
            </p>
            <p className="text-sm text-[#999] leading-[1.75] italic">
              This section becomes a profile block with each consultant&apos;s name, headshot,
              previous role, and one-line bio — populated once written permission is confirmed.
              Current candidates: David Cook, Alex Bedborough.
            </p>
          </div>
        </div>
      </section>

      {/* ── MID-PAGE CTA ─────────────────────────────────────── */}
      <section className="bg-navy py-16 px-6">
        <div className="hero-dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Ready to start?
            </h2>
            <p className="text-sm font-light text-white/65">
              20 founding cohort places at $299. After they&apos;re gone, the next cohort opens at $599.
            </p>
          </div>
          <CtaButton className="btn-hero-primary shrink-0 inline-flex items-center gap-2 text-xs font-medium uppercase px-8 py-4 tracking-brand-xs whitespace-nowrap" />
        </div>
      </section>

      {/* ── SECTION 3: HOW IT WORKS ──────────────────────────── */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionLabel>The format</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-12">
            How it works
          </h2>

          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-4 top-6 bottom-6 w-px bg-border-light hidden md:block" />

            <div className="flex flex-col gap-0">
              {TIMELINE.map(({ label, sublabel, body }, i) => (
                <div key={i} className="relative flex gap-8 md:gap-12 pb-10 last:pb-0">
                  {/* Step dot */}
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full border border-teal bg-white flex items-center justify-center z-10 relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal" />
                    </div>
                  </div>

                  <div className="flex-1 pt-1.5">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <h3 className="text-sm font-bold text-navy">{label}</h3>
                      {sublabel && (
                        <span className="text-xs text-teal uppercase tracking-brand-sm font-medium">
                          {sublabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#666] leading-[1.8]">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Closing line */}
          <div className="mt-12 pt-8 border-t border-border-light">
            <p className="text-sm font-medium text-navy/60 leading-[1.75] italic">
              The candidate produces the work alone. That&apos;s the point. The portfolio only
              means something if the work is yours.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: WHO DESIGNED THE RUBRIC ──────────────── */}
      <section className="bg-grey-bg py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionLabel>Expert design</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-6 max-w-xl">
            Who designed the rubric
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div className="flex flex-col gap-5">
              <p className="text-base font-semibold text-navy leading-[1.6]">
                The rubric is the product. If the rubric is weak, the credential is worthless.
                So we don&apos;t write it ourselves.
              </p>
              <p className="text-base text-[#555] leading-[1.85]">
                The rubrics behind the Verified Cyber Threat Intelligence Work Portfolio are
                designed and validated by named senior practitioners with backgrounds in UK
                defence intelligence. Their previous roles include intelligence leadership in
                the British Army and MoD-adjacent intelligence work. They are the people we
                ourselves would want assessing our capability.
              </p>
              <p className="text-base text-[#555] leading-[1.85]">
                We name them publicly with their written permission.
              </p>
              <div className="border-l-2 border-teal pl-5 mt-2">
                <p className="text-sm text-[#555] leading-[1.8]">
                  This is the single thing that distinguishes Career Bridge from AI-only assessment
                  tools. The AI scores against the rubric — but the rubric is human,
                  expert-validated, and named.
                </p>
              </div>
            </div>

            {/* Consultant placeholder */}
            <div className="flex flex-col gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-dashed border-border-light p-6 flex gap-5 items-start">
                  <div className="w-12 h-12 rounded-full bg-navy/8 shrink-0 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#18284e" strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-navy/30 tracking-brand-md mb-1">
                      {i === 1 ? "David Cook" : "Alex Bedborough"}
                    </p>
                    <p className="text-xs text-[#bbb] leading-[1.6] italic">
                      Name, headshot, previous role, and one-line bio — added once written
                      permission is confirmed.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: WHO THIS IS FOR ───────────────────────── */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionLabel>Suitability</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-4">
            Who this is for, and who it isn&apos;t
          </h2>
          <p className="text-base text-[#666] mb-12 max-w-xl leading-[1.8]">
            Be honest with yourself before you click.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-light">
            {/* This is for you */}
            <div className="bg-white p-10">
              <div className="flex items-center gap-3 mb-7">
                <span className="w-2 h-2 rounded-full bg-teal" />
                <h3 className="text-sm font-bold text-navy uppercase tracking-brand-sm">
                  This is for you if
                </h3>
              </div>
              <ul className="flex flex-col gap-5">
                {FOR_YOU.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[#555] leading-[1.75]">
                    <CheckIcon />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* This is NOT for you */}
            <div className="bg-white p-10">
              <div className="flex items-center gap-3 mb-7">
                <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
                <h3 className="text-sm font-bold text-navy uppercase tracking-brand-sm">
                  This is not for you if
                </h3>
              </div>
              <ul className="flex flex-col gap-5">
                {NOT_FOR_YOU.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[#555] leading-[1.75]">
                    <CrossIcon />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: PRICING ───────────────────────────────── */}
      <section id="pricing" className="bg-grey-bg py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-4">
            $299. First 20 places. Then it goes up.
          </h2>
          <p className="text-base text-[#555] leading-[1.85] mb-12 max-w-2xl">
            The founding cohort is the first to run on this format. Twenty places. $299 each.
            After the founding cohort, the price for the same portfolio is $599.
          </p>
          <p className="text-base text-[#555] leading-[1.85] mb-12 max-w-2xl">
            We&apos;re pricing the founding cohort lower for one reason: founding cohort candidates
            help us prove the format. We&apos;ll ask you for a testimonial, permission to use
            anonymised excerpts from your portfolio as case study material, and honest feedback on
            what worked and what didn&apos;t. That&apos;s the deal. You get a verified portfolio at
            half the going price; we get the case studies that make the next cohort easier to sell.
          </p>

          {/* Pricing card */}
          <div className="max-w-lg">
            <div className="bg-white border-t-2 border-teal p-10 flex flex-col gap-8 shadow-sm">
              {/* Header */}
              <div>
                <p className="text-xs font-semibold uppercase text-teal tracking-brand-md mb-3">
                  Founding cohort place
                </p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-bold text-navy">$299</span>
                </div>
                <p className="text-xs text-[#999] mt-2 leading-[1.6]">
                  Prices in USD. UK and international buyers pay local-currency-equivalent
                  automatically at checkout via Stripe.
                </p>
              </div>

              <div className="h-px bg-border-light" />

              {/* Features */}
              <ul className="flex flex-col gap-4">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-[#555] leading-[1.7]">
                    <CheckIcon />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="h-px bg-border-light" />

              {/* CTA */}
              <div className="flex flex-col gap-4">
                <CtaButton className="w-full btn-apply flex items-center justify-center text-xs font-medium uppercase py-4 tracking-brand-xs" />
                <p className="text-xs text-center text-[#999]">
                  Founding cohort places remaining: [X of 20]
                </p>
              </div>
            </div>
          </div>

          {/* Recruiter quote placeholder */}
          <div className="mt-10 border border-dashed border-border-light bg-white p-7 max-w-lg">
            <p className="text-xs font-semibold uppercase text-navy/40 tracking-brand-md mb-2">
              Recruiter quote — placeholder
            </p>
            <p className="text-sm text-[#bbb] italic leading-[1.75]">
              To be added if the planned recruiter feedback session produces one.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: FAQs ──────────────────────────────────── */}
      <section id="faq" className="bg-white py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <SectionLabel>Common questions</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-12">
            FAQs
          </h2>

          <div className="border-t border-border-light">
            {FAQS.map((item, i) => (
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

      {/* ── SECTION 8: CLOSING CTA ───────────────────────────── */}
      <section className="relative bg-navy py-28 px-6 text-center overflow-hidden">
        <div className="hero-dot-grid absolute inset-0 pointer-events-none" />
        <div className="relative max-w-xl mx-auto flex flex-col items-center gap-7">
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-heading">
            20 places. Two weeks. A verified portfolio you own.
          </h2>
          <CtaButton className="btn-hero-primary inline-flex items-center gap-2 text-xs font-medium uppercase px-8 py-4 tracking-brand-xs" />
          <p className="text-xs text-white/35 uppercase tracking-brand-sm">
            Powered by Evidentize · Aligned to the UK Cyber Security Council Cyber Career Framework
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}

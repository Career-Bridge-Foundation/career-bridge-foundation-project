"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PRICING_PLANS, type PricingPlan } from "@/lib/pricing";

const NAVY = "#003359";
const TEAL = "#4DC5D2";

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0 mt-0.5"
    >
      <circle cx="8" cy="8" r="8" fill={TEAL} opacity="0.15" />
      <path
        d="M4.5 8.5l2.5 2.5 4.5-5"
        stroke={TEAL}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGetStarted() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType: plan.id, cancelUrl: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const isOutline = !plan.popular;

  return (
    <div
      className="relative flex flex-col bg-white rounded-2xl p-8 gap-6"
      style={{
        border: plan.popular ? `1px solid #E5E7EB` : "1px solid #E5E7EB",
        borderTop: plan.popular ? `3px solid ${TEAL}` : "1px solid #E5E7EB",
        boxShadow: plan.popular
          ? "0 8px 32px 0 rgba(0,51,89,0.12)"
          : "0 1px 4px 0 rgba(0,0,0,0.06)",
      }}
    >
      {plan.badge && (
        <span
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-semibold uppercase px-3 py-1 rounded-full text-white tracking-wide"
          style={{ backgroundColor: TEAL, letterSpacing: "0.06em" }}
        >
          {plan.badge}
        </span>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase text-gray-400" style={{ letterSpacing: "0.06em" }}>
          {plan.title}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-4xl font-bold" style={{ color: NAVY }}>
            {plan.price}
          </span>
        </div>
        <p className="text-sm text-gray-400">{plan.description}</p>
      </div>

      {/* Features */}
      <ul className="flex flex-col gap-3 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
            <Check />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="flex flex-col gap-2">
        {plan.ctaHref ? (
          <a
            href={plan.ctaHref}
            className="w-full text-center text-sm font-semibold py-3 px-6 rounded-lg border-2 transition-all hover:opacity-80"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            {plan.cta}
          </a>
        ) : (
          <button
            onClick={handleGetStarted}
            disabled={loading}
            className="w-full text-sm font-semibold py-3 px-6 rounded-lg border-2 transition-all hover:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={
              isOutline
                ? { borderColor: NAVY, color: NAVY, background: "transparent" }
                : { borderColor: NAVY, backgroundColor: NAVY, color: "#fff" }
            }
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Processing…
              </>
            ) : (
              plan.cta
            )}
          </button>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header variant="solid" />

      <main className="flex-1 pt-28 pb-24 px-6 md:px-12">
        {/* Hero copy */}
        <div className="max-w-2xl mx-auto text-center mb-8">
          <h1
            className="text-4xl md:text-5xl font-bold leading-tight mb-4"
            style={{ color: NAVY }}
          >
            Choose Your Plan
          </h1>
          <p className="text-base md:text-lg text-gray-500">
            Prove your capability. Build your portfolio. Share your work.
          </p>
          <p className="text-sm text-gray-400 mt-3">
            Pricing applies across all disciplines — Product Management, Project Management, Cyber Security, Data Analytics, and more.
          </p>
        </div>

        {/* Credit notice */}
        <div
          className="max-w-2xl mx-auto mb-10 flex items-start gap-3 px-4 py-3.5 rounded-lg"
          style={{ background: 'rgba(77,197,210,0.07)', borderLeft: `3px solid ${TEAL}` }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 mt-0.5">
            <circle cx="12" cy="8" r="5" stroke={TEAL} strokeWidth="1.7" />
            <path d="M8.56 17.39L7 22l5-3 5 3-1.56-4.61" stroke={TEAL} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Simulation credit required
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              You need at least one credit to start a simulation. Each plan below includes credits — choose what fits your goals.
            </p>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {[
                { label: '1 credit', sub: 'Single sim' },
                { label: '3 credits', sub: 'Best value' },
                { label: '14 credits', sub: 'Full discipline' },
              ].map(({ label, sub }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium"
                  style={{ background: 'rgba(0,51,89,0.06)', color: NAVY }}
                >
                  {label}
                  <span className="text-gray-400 font-normal">·</span>
                  <span className="text-gray-400 font-normal">{sub}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Cards grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {PRICING_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

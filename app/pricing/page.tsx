"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

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

type PriceType = "single" | "bundle" | "portfolio" | "coach";

interface Plan {
  id: PriceType;
  title: string;
  price: string;
  description: string;
  badge?: string;
  features: string[];
  cta: string;
  ctaHref?: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "single",
    title: "Single Simulation",
    price: "£49.99",
    description: "one-off",
    features: [
      "1 workplace simulation",
      "AI-powered evaluation",
      "Detailed feedback report",
      "Digitally verifiable credential",
      "AI-powered simulation assistant",
    ],
    cta: "Get Started",
  },
  {
    id: "bundle",
    title: "Simulation Bundle",
    price: "£129.99",
    description: "save £20",
    features: [
      "3 workplace simulations",
      "AI-powered evaluation",
      "Detailed feedback reports",
      "Digitally verifiable credentials",
      "AI-powered simulation assistant",
      "Portfolio building across scenarios",
      "Access to Career Bridge community",
    ],
    cta: "Get Started",
  },
  {
    id: "portfolio",
    title: "Complete Discipline",
    price: "£349.99",
    description: "one discipline, full depth",
    badge: "Most Popular",
    features: [
      "All simulations in your chosen discipline",
      "AI-powered evaluation",
      "Detailed feedback reports",
      "Digitally verifiable credentials",
      "AI-powered simulation assistant",
      "End-to-end discipline mastery",
      "Priority support",
      "Access to Career Bridge community",
    ],
    cta: "Get Started",
    popular: true,
  },
  {
    id: "coach",
    title: "Coach Pack",
    price: "£1,499.99",
    description: "10 candidate seats",
    features: [
      "10 candidate access seats",
      "All simulations included",
      "Candidate progress dashboard",
      "Bulk credential issuance",
      "White-label ready",
      "Dedicated support",
      "Access to Career Bridge community",
    ],
    cta: "Contact Us",
    ctaHref: "mailto:outreach@careerbridgefoundation.com",
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGetStarted() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType: plan.id }),
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
        <div className="max-w-2xl mx-auto text-center mb-16">
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

        {/* Cards grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

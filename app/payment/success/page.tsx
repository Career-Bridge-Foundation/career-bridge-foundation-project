"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/client";
import { checkSimulationAccess } from "@/lib/access-control";

const NAVY = "#003359";
const TEAL = "#4dc5d2";
const REDIRECT_TO = "/simulations/product-management/product-strategy";
const MAX_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

const PLAN_LABELS: Record<string, string> = {
  single:    "Single Simulation",
  bundle:    "Bundle — 3 Simulations",
  portfolio: "Full PM Portfolio",
  coach:     "Coach Licence",
};

interface SessionDetails {
  transactionId: string | null;
  time: string;
  date: string;
  paymentMethod: string;
  planName: string | null;
  sessionId: string;
  amount: string | null;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: "1px solid #f0f0f0" }}>
      <span className="text-sm" style={{ color: "#888", whiteSpace: "nowrap" }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: NAVY }}>{value}</span>
    </div>
  );
}

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [accessStatus, setAccessStatus] = useState<"polling" | "ready" | "timeout">("polling");
  const [details, setDetails] = useState<SessionDetails | null>(null);

  // Fetch Stripe session details for receipt
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/stripe/session?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setDetails(data);
      })
      .catch(() => {});
  }, [sessionId]);

  // Poll until webhook credits the account, then redirect
  useEffect(() => {
    let attempts = 0;
    let cancelled = false;

    async function poll() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { hasAccess } = await checkSimulationAccess(user.id);

      if (hasAccess) {
        if (!cancelled) {
          setAccessStatus("ready");
          router.replace(REDIRECT_TO);
        }
        return;
      }

      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        if (!cancelled) setAccessStatus("timeout");
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => { cancelled = true; };
  }, [router]);

  const planLabel = details?.planName ? (PLAN_LABELS[details.planName] ?? details.planName) : null;
  const shortSession = details?.sessionId
    ? `CBF-${details.sessionId.replace("cs_", "").slice(-8).toUpperCase()}`
    : null;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#f3f3f3" }}>
      <Header variant="solid" />

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div
          className="w-full max-w-sm bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid #e8e8e8", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}
        >
          {/* Top section */}
          <div className="flex flex-col items-center gap-3 pt-10 pb-6 px-8">
            {/* Animated checkmark */}
            <div
              className="flex items-center justify-center w-16 h-16 rounded-full"
              style={{ backgroundColor: TEAL }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path
                  d="M8 16.5l5.5 5.5 10.5-12"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="60"
                  strokeDashoffset="60"
                  style={{ animation: "draw 0.5s ease-out 0.15s forwards" }}
                />
              </svg>
            </div>

            <div className="text-center">
              <h1 className="text-lg font-bold" style={{ color: NAVY }}>
                Payment Successful
              </h1>
              {details?.amount && (
                <p className="text-sm mt-1" style={{ color: "#888" }}>
                  Successfully Paid {details.amount}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: "#f0f0f0" }} />

          {/* Receipt details */}
          <div className="px-8 pt-5 pb-2">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#aaa" }}>
              Details
            </p>

            <Row label="Transaction ID" value={details?.transactionId ?? null} />
            <Row label="Time" value={details?.time ?? null} />
            <Row label="Date" value={details?.date ?? null} />
            <Row label="Payment Method" value={details?.paymentMethod ?? null} />
            <Row label="Plan" value={planLabel} />
            <Row label="Session ID" value={shortSession} />
            <div className="flex items-start justify-between gap-4 py-3">
              <span className="text-sm font-semibold" style={{ color: NAVY }}>Total Amount</span>
              <span className="text-sm font-bold" style={{ color: NAVY }}>{details?.amount ?? "—"}</span>
            </div>
          </div>

          {/* Status bar */}
          <div className="px-8 pb-8 pt-2 flex flex-col items-center gap-3">
            {accessStatus === "polling" && (
              <>
                <p className="text-xs" style={{ color: "#aaa" }}>Setting up your access…</p>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#e5e7eb" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: "40%", backgroundColor: TEAL, animation: "slide 1.4s ease-in-out infinite" }}
                  />
                </div>
              </>
            )}

            {accessStatus === "ready" && (
              <p className="text-xs font-medium" style={{ color: TEAL }}>
                Access confirmed. Taking you in…
              </p>
            )}

            {accessStatus === "timeout" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-center" style={{ color: "#888", lineHeight: 1.6 }}>
                  Your payment was received. Click below to start.
                </p>
                <Link
                  href={REDIRECT_TO}
                  className="inline-flex items-center gap-2 px-7 py-3 text-white text-sm font-semibold rounded-md transition-opacity hover:opacity-90"
                  style={{ backgroundColor: NAVY }}
                >
                  Start My Simulation →
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes draw { to { stroke-dashoffset: 0; } }
        @keyframes slide {
          0%   { transform: translateX(-250%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

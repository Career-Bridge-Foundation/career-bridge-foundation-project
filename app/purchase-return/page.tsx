"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const NAVY = "#003359";
const TEAL = "#4dc5d2";
const MAX_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

type Status = "polling" | "activating" | "ready" | "timeout" | "error";

function PurchaseReturnFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-20" style={{ backgroundColor: "#f3f3f3" }}>
      <div
        className="flex w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl bg-white"
        style={{ border: "1px solid #e8e8e8", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", minHeight: 260 }}
      >
        <div
          className="h-10 w-10 rounded-full border-4"
          style={{ borderColor: "#e5e7eb", borderTopColor: TEAL, animation: "spin 0.8s linear infinite" }}
        />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PurchaseReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const simulationId = searchParams.get("simulation_id");
  const cohortId = searchParams.get("cohort_id");
  const returnTo = searchParams.get("return_to") ?? "/";

  const [status, setStatus] = useState<Status>("polling");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activate = useCallback(async () => {
    if (!simulationId) {
      setStatus("error");
      setErrorMessage("Missing simulation reference — please return to the simulation and try again.");
      return;
    }
    setStatus("activating");
    try {
      const res = await fetch("/api/candidate/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulation_id: simulationId,
          cohort_id: cohortId ?? undefined,
          immediate_performance_consent: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("ready");
        router.replace(returnTo);
        return;
      }
      // insufficient_balance here means the webhook hasn't landed yet — the
      // poll loop below will retry. Any other failure is terminal.
      if (data.code !== "insufficient_balance") {
        setStatus("error");
        setErrorMessage("Something went wrong activating your simulation. Please try again from the simulation page.");
      } else {
        setStatus("polling");
      }
    } catch {
      setStatus("polling");
    }
  }, [simulationId, cohortId, returnTo, router]);

  // Poll until the webhook has minted credits, then activate. A bare
  // "no credits" screen right after a successful payment is the state
  // this loop exists to prevent (Spec 16 "The return race").
  useEffect(() => {
    let attempts = 0;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/candidate/entitlement");
        const data = await res.json();
        if (data?.balance?.total > 0) {
          if (!cancelled) await activate();
          return;
        }
      } catch {
        // transient — keep polling
      }

      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        if (!cancelled) setStatus("timeout");
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-20" style={{ backgroundColor: "#f3f3f3" }}>
      <div
        className="flex w-full max-w-sm flex-col items-center gap-4 overflow-hidden rounded-2xl bg-white px-8 py-10 text-center"
        style={{ border: "1px solid #e8e8e8", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}
      >
        {(status === "polling" || status === "activating") && (
          <>
            <div
              className="h-10 w-10 rounded-full border-4"
              style={{ borderColor: "#e5e7eb", borderTopColor: TEAL, animation: "spin 0.8s linear infinite" }}
            />
            <h1 className="text-base font-bold" style={{ color: NAVY }}>
              {status === "activating" ? "Setting up your simulation…" : "Confirming your payment…"}
            </h1>
            <p className="text-xs" style={{ color: "#888" }}>
              This usually takes a few seconds.
            </p>
          </>
        )}

        {status === "ready" && (
          <p className="text-sm font-medium" style={{ color: TEAL }}>
            Payment confirmed. Taking you in…
          </p>
        )}

        {status === "timeout" && (
          <>
            <h1 className="text-base font-bold" style={{ color: NAVY }}>
              Your payment was received
            </h1>
            <p className="text-xs" style={{ color: "#888", lineHeight: 1.6 }}>
              It&apos;s taking a little longer than usual to confirm. Click below to check again.
            </p>
            <button
              type="button"
              onClick={activate}
              className="mt-2 inline-flex items-center gap-2 rounded-md px-7 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: NAVY }}
            >
              Continue →
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-base font-bold" style={{ color: NAVY }}>
              Something went wrong
            </h1>
            <p className="text-xs" style={{ color: "#888", lineHeight: 1.6 }}>
              {errorMessage}
            </p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function PurchaseReturnPage() {
  return (
    <Suspense fallback={<PurchaseReturnFallback />}>
      <PurchaseReturnContent />
    </Suspense>
  );
}

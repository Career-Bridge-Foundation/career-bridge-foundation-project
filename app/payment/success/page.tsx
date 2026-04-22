"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/client";
import { checkSimulationAccess } from "@/lib/access-control";

const NAVY = "#003359";
const REDIRECT_TO = "/simulations/product-management/product-strategy";
const MAX_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"polling" | "ready" | "timeout">("polling");
  const [dots, setDots] = useState(".");

  // Animate the ellipsis while polling
  useEffect(() => {
    if (status !== "polling") return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(t);
  }, [status]);

  // Poll until the webhook has credited the account, then redirect
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
          setStatus("ready");
          router.replace(REDIRECT_TO);
        }
        return;
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
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header variant="solid" />

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="flex flex-col items-center text-center max-w-lg gap-8">
          <Image
            src="/logo-colour.png"
            alt="Career Bridge"
            width={160}
            height={48}
            priority
          />

          <div className="flex flex-col items-center gap-4">
            <h1 className="text-3xl font-bold leading-tight" style={{ color: NAVY }}>
              Payment Successful
            </h1>

            {status === "polling" && (
              <p className="text-base text-gray-600 leading-relaxed">
                Setting up your access{dots}
              </p>
            )}

            {status === "ready" && (
              <p className="text-base text-gray-600 leading-relaxed">
                Access confirmed. Redirecting you now…
              </p>
            )}

            {status === "timeout" && (
              <>
                <p className="text-base text-gray-600 leading-relaxed">
                  Your payment was received. It may take a moment to activate — click below when ready.
                </p>
                <Link
                  href={REDIRECT_TO}
                  className="inline-flex items-center gap-2 px-8 py-3 text-white font-semibold rounded-md transition-opacity hover:opacity-90"
                  style={{ backgroundColor: NAVY }}
                >
                  Start My Simulation →
                </Link>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

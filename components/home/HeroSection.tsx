"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function HeroSection() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const firstName = (user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0];

  return (
    <section className="relative min-h-screen flex items-center px-6 bg-navy">
      {/* Dot grid overlay */}
      <div className="hero-dot-grid absolute inset-0 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto w-full pt-24 pb-20">
        {/* Teal line + label */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-px bg-teal" />
          <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
            {user ? "Welcome Back" : "Portfolio Simulations"}
          </span>
        </div>

        {/* Headline */}
        {user ? (
          <h1 className="font-bold leading-hero">
            <span className="block text-[clamp(2rem,4vw,3.5rem)] text-white whitespace-nowrap">
              Good to see you,
            </span>
            <span className="block text-[clamp(2rem,4vw,3.5rem)] text-teal whitespace-nowrap">
              {firstName}.
            </span>
          </h1>
        ) : (
          <h1 className="font-bold leading-hero">
            <span className="block text-[clamp(2rem,4vw,3.5rem)] text-white whitespace-nowrap">
              Prove what you can do.
            </span>
            <span className="block text-[clamp(2rem,4vw,3.5rem)] text-teal whitespace-nowrap">
              Not just what you know.
            </span>
          </h1>
        )}

        {/* Subheading */}
        <p className="mt-7 text-base md:text-lg font-light text-white/[0.72] leading-[1.75] max-w-[700px]">
          {user
            ? "Pick up where you left off or start a new simulation to keep building your portfolio."
            : "Complete realistic workplace simulations, receive AI-evaluated feedback, and build a portfolio of evidence that employers actually trust."}
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          {user ? (
            <>
              <a
                href="#simulations"
                className="btn-hero-primary inline-flex items-center justify-center px-8 py-3.5 text-sm font-medium uppercase"
              >
                Go to Simulations
              </a>
              <a
                href="/profile"
                className="btn-hero-secondary inline-flex items-center justify-center px-8 py-3.5 text-sm font-medium uppercase"
              >
                View My Portfolio
              </a>
            </>
          ) : (
            <>
              <a
                href="#simulations"
                className="btn-hero-primary inline-flex items-center justify-center px-8 py-3.5 text-sm font-medium uppercase"
              >
                Start a Simulation
              </a>
              <a
                href="#how-it-works"
                className="btn-hero-secondary inline-flex items-center justify-center px-8 py-3.5 text-sm font-medium uppercase"
              >
                See how it works
              </a>
            </>
          )}
        </div>

        {/* Trust signals */}
        <div className="mt-14 flex flex-col sm:flex-row gap-6 sm:gap-12">
          {["AI-evaluated feedback", "Shareable portfolio output"].map((item) => (
            <span
              key={item}
              className="text-xs font-medium uppercase text-white/45 tracking-brand-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

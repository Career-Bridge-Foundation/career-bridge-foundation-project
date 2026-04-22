"use client";

import { useEffect, useState } from "react";
import { useScrolled } from "@/hooks/useScrolled";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface HeaderProps {
  /** "transparent" fades in as white when scrolled (default).
   *  "solid" is always white with border (e.g. simulation execution page). */
  variant?: "transparent" | "solid";
  /** When true, nav links are #hash anchors and Apply goes to #simulations. */
  homeMode?: boolean;
}

const NAV_LINKS = ["Simulations", "For Coaches", "Pricing", "About", "Blog"];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Header({ variant = "transparent", homeMode = false }: HeaderProps) {
  const scrolled = useScrolled();
  const isSolid = variant === "solid" || scrolled;
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? "";
  const firstName = displayName.split(" ")[0];

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        isSolid ? "bg-white border-b border-border-light" : "bg-transparent"
      )}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between relative">
        {/* Logo */}
        <a href="/">
          <img
            src="/logo-colour.png"
            alt="Career Bridge Foundation"
            className="h-10 w-auto"
          />
        </a>

        {/* Centre nav links */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map((link) => {
            const href = homeMode
              ? `#${link.toLowerCase().replace(/ /g, "-")}`
              : `/${link.toLowerCase().replace(/ /g, "-")}`;
            return (
              <a
                key={link}
                href={href}
                className={cn(
                  "text-xs font-medium uppercase tracking-brand-sm hover:opacity-60 transition-opacity",
                  isSolid ? "text-navy" : "text-white"
                )}
              >
                {link}
              </a>
            );
          })}
        </nav>

        {user ? (
          /* Logged-in state */
          <div className="flex items-center gap-5">
            {/* Avatar + Name */}
            <div className="flex items-center gap-3">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={firstName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-2 ring-offset-1 ring-border-light"
                />
              ) : (
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ring-2 ring-offset-1",
                  isSolid ? "bg-navy text-white ring-border-light" : "bg-white text-navy ring-white/30"
                )}>
                  {getInitials(displayName)}
                </div>
              )}
              <span className={cn(
                "text-xs font-medium uppercase tracking-brand-sm hidden md:block",
                isSolid ? "text-navy" : "text-white"
              )}>
                {firstName}
              </span>
            </div>

            {/* Divider */}
            <div className={cn("h-5 w-px hidden md:block", isSolid ? "bg-border-light" : "bg-white/20")} />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className={cn(
                "text-xs font-medium uppercase tracking-brand-sm px-4 py-2 border transition-opacity hover:opacity-60 cursor-pointer",
                isSolid ? "text-navy border-border-light" : "text-white border-white/30"
              )}
            >
              Log Out
            </button>
          </div>
        ) : (
          /* Logged-out state */
          <div className="flex items-center gap-3">
            <a
              href="/auth/login"
              className={cn(
                "text-xs font-medium uppercase tracking-brand-sm px-5 py-2.5 transition-opacity hover:opacity-60 border",
                isSolid ? "text-navy border-border-light" : "text-white border-white/30"
              )}
            >
              Login
            </a>
            <a
              href="/auth/signup"
              className={cn(
                "text-xs font-medium uppercase tracking-brand-sm px-5 py-2.5",
                isSolid ? "btn-apply" : "btn-apply-inverted"
              )}
            >
              Sign Up
            </a>
          </div>
        )}
      </div>
    </header>
  );
}

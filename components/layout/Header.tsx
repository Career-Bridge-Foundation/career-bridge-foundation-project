"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useScrolled } from "@/hooks/useScrolled";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { useBranding } from "@/components/branding/BrandingProvider";
import type { User } from "@supabase/supabase-js";

interface HeaderProps {
  /** "transparent" fades in as white when scrolled (default).
   *  "solid" is always white with border (e.g. simulation execution page). */
  variant?: "transparent" | "solid";
  /** When true, nav links are #hash anchors and Apply goes to #simulations. */
  homeMode?: boolean;
}

const NAV_LINKS = [
  { label: "Simulations", href: "/simulations", homeHref: "#simulations" },
  { label: "For Coaches", href: "/for-coaches", homeHref: "/for-coaches" },
  { label: "Pricing", href: "/pricing", homeHref: "/pricing" },
  {
    label: "About",
    href: "https://evidentize.io",
    homeHref: "https://evidentize.io",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Header({
  variant = "transparent",
  homeMode = false,
}: HeaderProps) {
  const scrolled = useScrolled();
  const isSolid = variant === "solid" || scrolled;
  const branding = useBranding();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? "";
  const firstName = displayName.split(" ")[0];

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        isSolid ? "bg-white border-b border-border-light" : "bg-transparent",
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-4 flex items-center justify-between relative">
        {/* Logo */}
        <Link href="/">
          <img
            src={
              isSolid
                ? branding?.logo_url_on_light ?? "/evidentize-logo-colour.png"
                : branding?.logo_url_on_dark ?? "/evidentize-logo-white.png"
            }
            alt={branding?.name ?? "Evidentize"}
            className="h-10 w-auto"
          />
        </Link>

        {/* Centre nav links */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-6 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map(({ label, href, homeHref }) => {
            const to = homeMode ? homeHref : href;
            const isExternal = to.startsWith("http");
            return isExternal ? (
              <a
                key={label}
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-[10px] lg:text-xs font-medium uppercase tracking-brand-sm hover:opacity-60 transition-opacity whitespace-nowrap",
                  isSolid ? "text-navy" : "text-white",
                )}
              >
                {label}
              </a>
            ) : (
              <Link
                key={label}
                href={to}
                className={cn(
                  "text-[10px] lg:text-xs font-medium uppercase tracking-brand-sm hover:opacity-60 transition-opacity whitespace-nowrap",
                  isSolid ? "text-navy" : "text-white",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {!ready ? null : user ? (
          /* Logged-in state — avatar dropdown */
          <div className="hidden md:flex items-center gap-2 lg:gap-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-3 cursor-pointer"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={firstName}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-2 ring-offset-1 ring-border-light"
                  />
                ) : (
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ring-2 ring-offset-1",
                      isSolid
                        ? "bg-navy text-white ring-border-light"
                        : "bg-white text-navy ring-white/30",
                    )}
                  >
                    {getInitials(displayName)}
                  </div>
                )}
                <span
                  className={cn(
                    "text-[10px] lg:text-xs font-medium uppercase tracking-brand-sm hidden lg:flex items-center gap-1",
                    isSolid ? "text-navy" : "text-white",
                  )}
                >
                  {firstName}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="currentColor"
                    className={cn("transition-transform duration-150", dropdownOpen && "rotate-180")}
                  >
                    <path d="M1.5 3.5L5 7l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </span>
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 bg-white border border-border-light shadow-lg z-50 py-1"
                  style={{ borderRadius: "4px" }}
                >
                  <Link
                    href="/account/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-navy uppercase tracking-brand-sm hover:bg-slate-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                    My Profile
                  </Link>
                  <Link
                    href="/account/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-navy uppercase tracking-brand-sm hover:bg-slate-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    Account Settings
                  </Link>
                  <div className="my-1 border-t border-border-light" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-navy/70 uppercase tracking-brand-sm hover:bg-slate-50 transition-colors text-left"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Logged-out state */
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            <a
              href="/auth/login"
              className={cn(
                "text-[10px] lg:text-xs font-medium uppercase tracking-brand-sm px-2.5 lg:px-5 py-1.5 lg:py-2.5 transition-opacity hover:opacity-60 border whitespace-nowrap",
                isSolid
                  ? "text-navy border-border-light"
                  : "text-white border-white/30",
              )}
            >
              Login
            </a>
            <a
              href="/auth/signup"
              className={cn(
                "text-[10px] lg:text-xs font-medium uppercase tracking-brand-sm px-2.5 lg:px-5 py-1.5 lg:py-2.5 whitespace-nowrap",
                isSolid ? "btn-apply" : "btn-apply-inverted",
              )}
            >
              Sign Up
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={cn(
            "md:hidden relative inline-flex items-center justify-center w-10 h-10 transition-transform duration-200 ease-out active:scale-95",
            isSolid ? "text-navy" : "text-white",
          )}
          aria-label={
            mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={mobileMenuOpen}
        >
          <span
            className={cn(
              "absolute h-0.5 w-5 bg-current transition-all duration-300 ease-out",
              mobileMenuOpen ? "rotate-45 top-[19px]" : "top-[13px]",
            )}
          />
          <span
            className={cn(
              "absolute h-0.5 w-5 bg-current transition-all duration-200 ease-out",
              mobileMenuOpen ? "opacity-0 scale-0" : "opacity-100 scale-100",
            )}
          />
          <span
            className={cn(
              "absolute h-0.5 w-5 bg-current transition-all duration-300 ease-out",
              mobileMenuOpen ? "-rotate-45 top-[19px]" : "top-[25px]",
            )}
          />
        </button>
      </div>

      <div
        className={cn(
          "md:hidden bg-white overflow-hidden origin-top transition-all duration-300 ease-out",
          mobileMenuOpen
            ? "max-h-[80vh] opacity-100 scale-y-100 translate-y-0"
            : "max-h-0 opacity-0 scale-y-95 -translate-y-1 pointer-events-none",
        )}
      >
        <div
          className={cn(
            "pt-2 transition-opacity duration-200",
            mobileMenuOpen ? "opacity-100 delay-100" : "opacity-0",
          )}
        >
          <nav className="px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map(({ label, href, homeHref }) => {
              const to = homeMode ? homeHref : href;
              const isExternal = to.startsWith("http");
              return isExternal ? (
                <a
                  key={label}
                  href={to}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobileMenu}
                  className="px-2 py-3 text-xs font-medium uppercase tracking-brand-sm text-navy"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={label}
                  href={to}
                  onClick={closeMobileMenu}
                  className="px-2 py-3 text-xs font-medium uppercase tracking-brand-sm text-navy"
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {!ready ? null : user ? (
            <div className="px-4 pb-4 flex flex-col gap-1">
              <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-brand-sm text-navy/50 border-t border-border-light mb-1 pt-3">
                {firstName}
              </div>
              <Link
                href="/account/profile"
                onClick={closeMobileMenu}
                className="px-2 py-3 text-xs font-medium uppercase tracking-brand-sm text-navy"
              >
                My Profile
              </Link>
              <Link
                href="/account/settings"
                onClick={closeMobileMenu}
                className="px-2 py-3 text-xs font-medium uppercase tracking-brand-sm text-navy"
              >
                Account Settings
              </Link>
              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full text-xs font-medium uppercase tracking-brand-sm px-4 py-2 border border-border-light text-navy"
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              <Link
                href="/auth/login"
                onClick={closeMobileMenu}
                className="text-center text-xs font-medium uppercase tracking-brand-sm px-4 py-2 border border-border-light text-navy"
              >
                Login
              </Link>
              <Link
                href="/auth/signup"
                onClick={closeMobileMenu}
                className="text-center text-xs font-medium uppercase tracking-brand-sm px-4 py-2 bg-navy text-white"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

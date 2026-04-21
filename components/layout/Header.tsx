"use client";

import { useScrolled } from "@/hooks/useScrolled";
import { cn } from "@/lib/cn";

interface HeaderProps {
  /** "transparent" fades in as white when scrolled (default).
   *  "solid" is always white with border (e.g. simulation execution page). */
  variant?: "transparent" | "solid";
  /** When true, nav links are #hash anchors and Apply goes to #simulations. */
  homeMode?: boolean;
}

const NAV_LINKS = ["Simulations", "For Coaches", "Pricing", "About", "Blog"];

export function Header({ variant = "transparent", homeMode = false }: HeaderProps) {
  const scrolled = useScrolled();
  const isSolid = variant === "solid" || scrolled;

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

        {/* Apply button */}
        <a
          href={homeMode ? "#simulations" : "/auth/signup"}
          className={cn(
            "text-xs font-medium uppercase px-5 py-2.5",
            isSolid ? "btn-apply" : "btn-apply-inverted"
          )}
        >
          Apply
        </a>
      </div>
    </header>
  );
}

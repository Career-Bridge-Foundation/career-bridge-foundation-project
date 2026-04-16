"use client";

import { useState, useEffect } from "react";

const TEAL = "#4DC5D2";
const NAVY = "#003359";
const BORDER = "#D5DCE8";
const LIGHT_GREY = "#F3F3F3";

// ── Simulation data ──────────────────────────────────────
const simulations = [
  {
    id: 1,
    title: "Product Strategy",
    company: "Nexus Bank",
    industry: "Financial Services",
    type: "Strategy",
    difficulty: "Foundation",
    time: "45 mins",
    description:
      "Define the product strategy for a new startup banking account. Understand market needs, map the competitive landscape, and recommend a direction to the executive team.",
  },
  {
    id: 2,
    title: "Customer Research and Insights",
    company: "Vitara Health",
    industry: "HealthTech",
    type: "Discovery",
    difficulty: "Foundation",
    time: "45 mins",
    description:
      "Conduct user research for a new health monitoring feature. Develop an interview guide, identify user personas, and synthesise your findings into actionable insights.",
  },
  {
    id: 3,
    title: "Ideation and Prioritisation",
    company: "Stackly",
    industry: "SaaS",
    type: "Strategy",
    difficulty: "Foundation",
    time: "45 mins",
    description:
      "Your team has generated dozens of product ideas with limited resources. Prioritise them using structured frameworks and defend your decisions to stakeholders.",
  },
  {
    id: 4,
    title: "Agile Product Development",
    company: "Orbis Digital",
    industry: "Software Development",
    type: "Delivery",
    difficulty: "Practitioner",
    time: "60 mins",
    description:
      "Manage a cross-functional Agile team facing scope creep on a critical feature. Resolve the issue without disrupting the sprint or the team dynamic.",
  },
  {
    id: 5,
    title: "UX and UI Design",
    company: "Movo",
    industry: "Consumer Mobile",
    type: "Discovery",
    difficulty: "Practitioner",
    time: "60 mins",
    description:
      "Lead a mobile app redesign. Create a roadmap and product strategy that meets specific user needs while working effectively with the design team.",
  },
  {
    id: 6,
    title: "Pricing Strategies",
    company: "Lumora",
    industry: "EdTech",
    type: "Strategy",
    difficulty: "Practitioner",
    time: "60 mins",
    description:
      "Your company is switching from a freemium model to tiered pricing. Develop a pricing strategy, model the impact, and justify the change to leadership.",
  },
  {
    id: 7,
    title: "Product Launch",
    company: "Crest Consumer",
    industry: "Consumer Goods",
    type: "Go-to-Market",
    difficulty: "Practitioner",
    time: "75 mins",
    description:
      "Plan and execute a go-to-market strategy for a new product. Define your marketing channels, customer segments, and post-launch success metrics.",
  },
  {
    id: 8,
    title: "Metrics and Analytics",
    company: "Dataflow",
    industry: "Analytics",
    type: "Analysis",
    difficulty: "Practitioner",
    time: "60 mins",
    description:
      "Analyse KPIs following a product launch. Identify performance gaps, propose data-driven improvements, and present your recommendations clearly.",
  },
  {
    id: 9,
    title: "Stakeholder Management",
    company: "Bridgepoint",
    industry: "Infrastructure",
    type: "Stakeholder",
    difficulty: "Practitioner",
    time: "75 mins",
    description:
      "Navigate multiple stakeholders with conflicting interests. Build a communication plan that keeps everyone aligned without compromising the product vision.",
  },
  {
    id: 10,
    title: "Customer Acquisition",
    company: "Spark Retail",
    industry: "E-commerce",
    type: "Strategy",
    difficulty: "Practitioner",
    time: "60 mins",
    description:
      "Develop a customer acquisition strategy for a D2C brand entering a crowded market. Define your channels, cost per acquisition targets, and growth levers.",
  },
  {
    id: 11,
    title: "Go-to-Market Strategy",
    company: "Vanta Global",
    industry: "International Retail",
    type: "Go-to-Market",
    difficulty: "Advanced",
    time: "90 mins",
    description:
      "Lead the international expansion of a retail product into two new markets. Develop the full GTM strategy including localisation, pricing, and channel selection.",
  },
  {
    id: 12,
    title: "Product Market Fit",
    company: "Peakform",
    industry: "Sports Technology",
    type: "Discovery",
    difficulty: "Advanced",
    time: "90 mins",
    description:
      "Assess whether a sports performance product has achieved product market fit. Analyse signals, identify gaps, and recommend a path to stronger retention and growth.",
  },
  {
    id: 13,
    title: "Roadmap Development",
    company: "Claros",
    industry: "Enterprise Software",
    type: "Strategy",
    difficulty: "Advanced",
    time: "90 mins",
    description:
      "Build a 12 month product roadmap for an enterprise software platform. Balance technical debt, customer requests, and strategic initiatives across competing priorities.",
  },
  {
    id: 14,
    title: "Pitch Deck Creation",
    company: "Founded",
    industry: "Venture Capital",
    type: "Strategy",
    difficulty: "Advanced",
    time: "90 mins",
    description:
      "Create a compelling pitch deck for a new product concept. Structure your narrative, validate your assumptions, and present a convincing case to a panel of investors.",
  },
];

// ── Difficulty badge styles ──────────────────────────────
function difficultyStyle(level: string): React.CSSProperties {
  if (level === "Foundation") return { color: "#16a34a", border: "1px solid #16a34a" };
  if (level === "Practitioner") return { color: "#d97706", border: "1px solid #d97706" };
  return { color: NAVY, border: `1px solid ${NAVY}` };
}

// ── Clock icon ───────────────────────────────────────────
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ── Select component ─────────────────────────────────────
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-xs font-semibold uppercase"
        style={{ color: NAVY, letterSpacing: "0.12em" }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm px-3 py-2.5 bg-white appearance-none cursor-pointer"
        style={{
          border: `1px solid ${BORDER}`,
          color: NAVY,
          minWidth: "180px",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23003359' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          paddingRight: "32px",
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────
export default function SimulatePage() {
  const [scrolled, setScrolled] = useState(false);
  const [typeFilter, setTypeFilter] = useState("All");
  const [diffFilter, setDiffFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = simulations.filter((s) => {
    if (typeFilter !== "All" && s.type !== typeFilter) return false;
    if (diffFilter !== "All" && s.difficulty !== diffFilter) return false;
    if (industryFilter !== "All" && s.industry !== industryFilter) return false;
    return true;
  });

  const clearFilters = () => {
    setTypeFilter("All");
    setDiffFilter("All");
    setIndustryFilter("All");
  };

  const hasActiveFilter =
    typeFilter !== "All" || diffFilter !== "All" || industryFilter !== "All";

  return (
    <div className="min-h-screen">

      {/* ── NAVBAR ──────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        style={{
          backgroundColor: scrolled ? "#ffffff" : "transparent",
          borderBottom: scrolled ? `1px solid ${BORDER}` : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between relative">
          {/* Logo */}
          <img
            src="/logo-colour.png"
            alt="Career Bridge Foundation"
            style={{ height: "40px", width: "auto" }}
          />

          {/* Centre nav links */}
          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {["Simulations", "For Coaches", "About", "Blog"].map((link) => (
              <a
                key={link}
                href={`/${link.toLowerCase().replace(/ /g, "-")}`}
                className="text-xs font-medium uppercase transition-opacity hover:opacity-60"
                style={{
                  color: scrolled ? NAVY : "#ffffff",
                  letterSpacing: "0.12em",
                  transition: "color 0.2s, opacity 0.15s",
                }}
              >
                {link}
              </a>
            ))}
          </nav>

          {/* Apply button */}
          <a
            href="#"
            className={
              scrolled
                ? "btn-apply text-xs font-medium uppercase px-5 py-2.5"
                : "btn-apply-inverted text-xs font-medium uppercase px-5 py-2.5"
            }
            style={{ letterSpacing: "0.12em" }}
          >
            Apply
          </a>
        </div>
      </header>

      {/* ── PAGE HEADER ─────────────────────────────────────── */}
      <section
        className="relative px-6 pt-40 pb-20"
        style={{ backgroundColor: NAVY }}
      >
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative max-w-6xl mx-auto">
          {/* Teal line + label */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px" style={{ backgroundColor: TEAL }} />
            <span
              className="text-xs font-medium uppercase"
              style={{ color: TEAL, letterSpacing: "0.18em" }}
            >
              Product Management
            </span>
          </div>

          <h1
            className="font-bold text-white mb-5"
            style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", lineHeight: 1.15 }}
          >
            Build Your Product Management Portfolio
          </h1>

          <p
            className="text-base font-light mb-8 max-w-xl"
            style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.75 }}
          >
            Browse multiple Product Management workplace simulations, each
            designed around real industry scenarios and verified by experienced
            practitioners and product managers. Filter by scenario type,
            difficulty, or industry and start building evidence of your
            capability today.
          </p>

          {/* Pills */}
          <div className="flex flex-wrap gap-3">
            <span
              className="text-xs font-medium uppercase px-4 py-2"
              style={{ border: `1px solid ${TEAL}`, color: TEAL, letterSpacing: "0.12em" }}
            >
              Industry Recognised Capabilities
            </span>
            <span
              className="text-xs font-medium uppercase px-4 py-2"
              style={{
                border: "1px solid rgba(255,255,255,0.3)",
                color: "rgba(255,255,255,0.7)",
                letterSpacing: "0.12em",
              }}
            >
              Difficulty: Foundation to Advanced
            </span>
          </div>
        </div>
      </section>

      {/* ── FILTER BAR ──────────────────────────────────────── */}
      <div
        className="bg-white px-6 py-6"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          <FilterSelect
            label="Scenario Type"
            value={typeFilter}
            options={["All", "Strategy", "Discovery", "Delivery", "Go-to-Market", "Analysis", "Stakeholder"]}
            onChange={setTypeFilter}
          />
          <FilterSelect
            label="Difficulty"
            value={diffFilter}
            options={["All", "Foundation", "Practitioner", "Advanced"]}
            onChange={setDiffFilter}
          />
          <FilterSelect
            label="Industry"
            value={industryFilter}
            options={[
              "All",
              "Financial Services",
              "HealthTech",
              "SaaS",
              "Software Development",
              "Consumer Mobile",
              "EdTech",
              "Consumer Goods",
              "Analytics",
              "Infrastructure",
              "E-commerce",
              "International Retail",
              "Sports Technology",
              "Enterprise Software",
              "Venture Capital",
            ]}
            onChange={setIndustryFilter}
          />

          {/* Clear filters */}
          <div className="sm:ml-auto flex items-end pb-0.5">
            {hasActiveFilter ? (
              <button
                onClick={clearFilters}
                className="text-sm font-medium"
                style={{ color: TEAL }}
              >
                Clear filters
              </button>
            ) : (
              <span className="text-sm" style={{ color: "rgba(0,0,0,0)" }}>
                Clear filters
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── SIMULATIONS GRID ────────────────────────────────── */}
      <section className="px-6 py-16" style={{ backgroundColor: LIGHT_GREY }}>
        <div className="max-w-6xl mx-auto">

          {/* Result count */}
          <p
            className="text-xs font-medium uppercase mb-8"
            style={{ color: "#999", letterSpacing: "0.12em" }}
          >
            {filtered.length} simulation{filtered.length !== 1 ? "s" : ""} showing
          </p>

          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-base" style={{ color: "#888" }}>
                No simulations match your filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 text-sm font-medium"
                style={{ color: TEAL }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ backgroundColor: BORDER }}>
              {filtered.map((sim) => (
                <div
                  key={sim.id}
                  className="bg-white flex flex-col p-8"
                >
                  {/* Top badges */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span
                      className="text-xs font-semibold uppercase px-2.5 py-1"
                      style={{
                        color: TEAL,
                        border: `1px solid ${TEAL}`,
                        letterSpacing: "0.12em",
                      }}
                    >
                      {sim.type}
                    </span>
                    <span
                      className="text-xs font-semibold uppercase px-2.5 py-1"
                      style={{
                        letterSpacing: "0.12em",
                        ...difficultyStyle(sim.difficulty),
                      }}
                    >
                      {sim.difficulty}
                    </span>
                  </div>

                  {/* Title + company */}
                  <h3
                    className="text-base font-bold mb-1"
                    style={{ color: NAVY, lineHeight: 1.35 }}
                  >
                    {sim.title}
                  </h3>
                  <p
                    className="text-xs mb-4"
                    style={{ color: "#888" }}
                  >
                    {sim.company} &middot; {sim.industry}
                  </p>

                  {/* Description */}
                  <p
                    className="text-sm flex-1"
                    style={{ color: "#555", lineHeight: 1.75 }}
                  >
                    {sim.description}
                  </p>

                  {/* Divider + bottom row */}
                  <div
                    className="mt-6 pt-5 flex items-center justify-between"
                    style={{ borderTop: `1px solid ${BORDER}` }}
                  >
                    <span
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "#999" }}
                    >
                      <ClockIcon />
                      {sim.time}
                    </span>
                    <a
                      href="#"
                      className="text-sm font-medium"
                      style={{ color: TEAL }}
                      onMouseEnter={(e) =>
                        ((e.target as HTMLElement).style.textDecoration = "underline")
                      }
                      onMouseLeave={(e) =>
                        ((e.target as HTMLElement).style.textDecoration = "none")
                      }
                    >
                      Start Simulation →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer style={{ backgroundColor: NAVY }}>
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 md:gap-8">

            {/* Col 1: Brand */}
            <div className="flex flex-col gap-4">
              <img
                src="/logo-white.png"
                alt="Career Bridge Foundation"
                style={{ height: "48px", width: "auto", objectFit: "contain" }}
              />
            </div>

            {/* Col 2: Navigation */}
            <div>
              <p
                className="text-xs font-semibold uppercase mb-6"
                style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.14em" }}
              >
                Navigation
              </p>
              <div className="flex flex-col gap-3.5">
                {["Home", "How It Works", "Simulations", "For Coaches", "Contact"].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="footer-link text-sm"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            {/* Col 3: Policies */}
            <div>
              <p
                className="text-xs font-semibold uppercase mb-6"
                style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.14em" }}
              >
                Policies
              </p>
              <div className="flex flex-col gap-3.5">
                {[
                  "Privacy Policy",
                  "Terms of Use",
                  "Safeguarding Policy",
                  "Data Protection",
                  "Complaints Procedure",
                  "Other Policies",
                ].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="footer-link text-sm"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            {/* Col 4: Contact + Social */}
            <div>
              <p
                className="text-xs font-semibold uppercase mb-6"
                style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.14em" }}
              >
                Contact
              </p>

              <p className="text-xs italic mb-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                General Enquiries
              </p>
              <a
                href="mailto:support@careerbridgefoundation.zohodesk.eu"
                className="footer-link text-xs"
                style={{ color: TEAL, whiteSpace: "nowrap" }}
              >
                support@careerbridgefoundation.zohodesk.eu
              </a>

              <p className="text-xs italic mt-5 mb-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                Partnership Enquiries
              </p>
              <a
                href="mailto:outreach@careerbridgefoundation.com"
                className="footer-link text-xs"
                style={{ color: TEAL }}
              >
                outreach@careerbridgefoundation.com
              </a>

              <p
                className="text-xs mt-7 mb-4"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Follow Us
              </p>
              <div className="flex gap-3">
                {/* Instagram */}
                <a
                  href="https://www.instagram.com/careerbridgefoundation"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Instagram"
                  className="footer-link w-9 h-9 flex items-center justify-center"
                  style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.75)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
                  </svg>
                </a>
                {/* LinkedIn */}
                <a
                  href="https://www.linkedin.com/company/careerbridgefoundation"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="LinkedIn"
                  className="footer-link w-9 h-9 flex items-center justify-center"
                  style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.75)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                    <rect x="2" y="9" width="4" height="12"/>
                    <circle cx="4" cy="4" r="2"/>
                  </svg>
                </a>
                {/* Facebook */}
                <a
                  href="https://www.facebook.com/careerbridgefoundation"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook"
                  className="footer-link w-9 h-9 flex items-center justify-center"
                  style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.75)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                  </svg>
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="px-6 md:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            &copy; 2026 Career Bridge Foundation CIC. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Registered Company Number: 16939467
          </p>
        </div>
      </footer>

    </div>
  );
}

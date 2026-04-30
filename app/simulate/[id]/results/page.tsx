"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  loadEvaluationResult,
  loadEvaluationResultFromSupabase,
  type EvaluationResult,
  type EvaluationTask,
  type EvaluationCriterion,
} from "@/hooks/useEvaluation";
import { SIM, PROMPTS } from "@/lib/simulation-prompts";
import { claimCredential } from "@/lib/certifier";
import { createClient } from "@/lib/supabase/client";

// ── Constants ─────────────────────────────────────────────────────

const NAVY = "#003359";
const TEAL = "#4DC5D2";
const BORDER = "#D5DCE8";

// ── Verdict bands ─────────────────────────────────────────────────

const BANDS = [
  { label: "Did Not Pass", color: "#EF4444" },
  { label: "Borderline",   color: "#F59E0B" },
  { label: "Pass",         color: "#3B82F6" },
  { label: "Merit",        color: "#10B981" },
  { label: "Distinction",  color: "#003359" },
] as const;

function verdictBandIndex(verdict: EvaluationResult["verdict"]): number {
  if (verdict === "Distinction")     return 4;
  if (verdict === "Pass with Merit") return 3;
  if (verdict === "Pass")            return 2;
  if (verdict === "Borderline")      return 1;
  return 0;
}

// ── Level badge ───────────────────────────────────────────────────

function LevelBadge({ level }: { level: EvaluationCriterion["level"] }) {
  const map = {
    Strong: { bg: TEAL, text: "#fff" },
    Competent: { bg: "#006FAD", text: "#fff" },
    Weak: { bg: "#EF4444", text: "#fff" },
  };
  const s = map[level];
  return (
    <span
      className="text-xs font-semibold px-2.5 py-0.5 shrink-0"
      style={{
        backgroundColor: s.bg,
        color: s.text,
        borderRadius: "4px",
        letterSpacing: "0.04em",
      }}
    >
      {level}
    </span>
  );
}

// ── Task score ring (donut) ───────────────────────────────────────

const TASK_R = 20;
const TASK_CIRC = 2 * Math.PI * TASK_R;

function taskRingColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.89) return "#10B981";
  if (pct >= 0.67) return "#4DC5D2";
  if (pct >= 0.44) return "#F59E0B";
  return "#EF4444";
}

function TaskScoreRing({ score, max }: { score: number; max: number }) {
  const offset = TASK_CIRC * (1 - score / max);
  const ringColor = taskRingColor(score, max);
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      {/* Track */}
      <circle cx="24" cy="24" r={TASK_R} fill="none" stroke="#E5E7EB" strokeWidth="4" />
      {/* Fill */}
      <circle
        cx="24"
        cy="24"
        r={TASK_R}
        fill="none"
        stroke={ringColor}
        strokeWidth="4"
        strokeDasharray={TASK_CIRC}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "24px 24px" }}
      />
      {/* Score label */}
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill={NAVY}
        fontFamily="Inter, sans-serif"
      >
        {score}/{max}
      </text>
    </svg>
  );
}

// ── Task card ─────────────────────────────────────────────────────

function TaskCard({
  task,
  index,
  defaultOpen,
}: {
  task: EvaluationTask;
  index: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="mb-3"
      style={{ border: `1px solid ${BORDER}`, backgroundColor: "#fff" }}
    >
      {/* Card header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left"
        style={{ cursor: "pointer" }}
      >
        {/* Task number */}
        <span
          className="text-xs font-bold shrink-0"
          style={{ color: TEAL, letterSpacing: "0.14em", minWidth: "40px" }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Title */}
        <span className="text-sm font-semibold flex-1 text-left" style={{ color: NAVY }}>
          {task.title}
        </span>

        {/* Score ring */}
        <TaskScoreRing score={task.score} max={task.maxScore} />

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={NAVY}
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            opacity: 0.5,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded content */}
      {open && (
        <div
          className="px-6 pb-6"
          style={{ borderTop: `1px solid ${BORDER}` }}
        >
          {/* Criteria */}
          <div className="flex flex-col gap-5 mt-5">
            {task.criteria.map((c, ci) => (
              <div key={ci}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: NAVY, letterSpacing: "0.04em" }}
                  >
                    {c.name}
                  </span>
                  <LevelBadge level={c.level} />
                </div>
                <p className="text-sm" style={{ color: "#555", lineHeight: 1.75 }}>
                  {c.feedback}
                </p>
              </div>
            ))}
          </div>

          {/* Task summary */}
          {task.summary && (
            <div
              className="mt-6 pt-5 italic text-sm"
              style={{ color: "#777", borderTop: `1px solid ${BORDER}`, lineHeight: 1.8 }}
            >
              {task.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────

function EvaluatingScreen() {
  const messages = [
    ...PROMPTS.map((p) => `Reviewing your ${p.title}…`),
    "Compiling your assessment report…",
  ];

  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="min-h-screen flex flex-col">
      <style>{`
        @keyframes cb-progress {
          0%   { left: -45%; width: 45%; }
          100% { left: 110%; width: 45%; }
        }
      `}</style>
      <Header variant="solid" />
      {/* flex-1 fills remaining height; padding-top offsets the fixed header so justify-center centres in true remaining space */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-7 px-6"
        style={{ paddingTop: "120px", paddingBottom: "80px" }}
      >
        {/* CB logo */}
        <img
          src="/logo.png"
          alt="Career Bridge Foundation"
          style={{ width: "48px", height: "auto", objectFit: "contain" }}
        />

        {/* Heading */}
        <h2
          className="text-center"
          style={{ color: NAVY, fontWeight: 600, fontSize: "18px", lineHeight: 1.4 }}
        >
          Your submissions are being reviewed
        </h2>

        {/* Indeterminate progress bar */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            height: "4px",
            maxWidth: "300px",
            width: "100%",
            backgroundColor: "#E5E7EB",
            borderRadius: "9999px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              backgroundColor: TEAL,
              borderRadius: "9999px",
              animation: "cb-progress 1.8s ease-in-out infinite",
            }}
          />
        </div>

        {/* Rotating status message */}
        <p
          className="text-center"
          style={{
            color: "#888",
            fontSize: "13px",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.3s ease",
            minHeight: "20px",
          }}
        >
          {messages[msgIndex]}
        </p>

        {/* Footer caption */}
        <p style={{ color: "#bbb", fontSize: "12px" }}>
          This usually takes 15 to 30 seconds
        </p>
      </div>
      <Footer />
    </div>
  );
}

// ── Error screen ──────────────────────────────────────────────────

function ErrorScreen({ simulationId }: { simulationId: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="solid" />
      <div
        className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ paddingTop: "120px", paddingBottom: "80px" }}
      >
        {/* Clipboard icon */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="9" y1="16" x2="13" y2="16" />
        </svg>

        <p className="text-lg font-semibold" style={{ color: NAVY }}>
          Your results aren&apos;t ready yet
        </p>

        <p className="text-sm max-w-sm" style={{ color: "#888", lineHeight: 1.75 }}>
          It looks like you haven&apos;t submitted your simulation for review yet.
          Complete all tasks and click &lsquo;Submit Simulation&rsquo; to receive your
          assessment and credential.
        </p>

        <div className="flex flex-col items-center gap-3 mt-2">
          <a
            href={`/simulate/${simulationId}`}
            className="text-sm font-semibold px-7 py-3 text-white"
            style={{ backgroundColor: NAVY }}
          >
            Continue My Simulation →
          </a>
          <a
            href="/simulations"
            className="text-sm font-medium px-7 py-3"
            style={{ border: `1px solid ${NAVY}`, color: NAVY }}
          >
            Browse Other Simulations
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}

// ── Share section ─────────────────────────────────────────────────

function ShareSection({ result }: { result: EvaluationResult }) {
  const [tooltip, setTooltip] = useState<string | null>(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const verdictLabel = result.verdict === "Pass with Merit" ? "Merit" : result.verdict;
  const shareText = `I just completed the Product Strategy simulation on @CareerBridgeHQ and achieved ${verdictLabel}! Prove your capability at`;

  function showTooltip(msg: string) {
    setTooltip(msg);
    setTimeout(() => setTooltip(null), 2500);
  }

  async function copyLink(msg: string) {
    try {
      await navigator.clipboard.writeText(pageUrl);
      showTooltip(msg);
    } catch { /* ignore */ }
  }

  const buttons: {
    label: string;
    bg: string;
    href?: string;
    onClick?: () => void;
    icon: React.ReactNode;
  }[] = [
    {
      label: "LinkedIn",
      bg: "#0A66C2",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    {
      label: "X",
      bg: "#000000",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: "Facebook",
      bg: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
      ),
    },
    {
      label: "WhatsApp",
      bg: "#25D366",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      ),
    },
    {
      label: "Instagram",
      bg: "#E4405F",
      onClick: () => copyLink("Link copied! Share on Instagram"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
      ),
    },
    {
      label: "Threads",
      bg: "#000000",
      href: `https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`,
      icon: (
        <svg width="17" height="17" viewBox="0 0 192 192" fill="white">
          <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0135 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0077 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z" />
        </svg>
      ),
    },
    {
      label: "TikTok",
      bg: "#000000",
      onClick: () => copyLink("Link copied! Share on TikTok"),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z" />
        </svg>
      ),
    },
    {
      label: "Pinterest",
      bg: "#E60023",
      href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&description=${encodeURIComponent(shareText)}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed top-6 left-1/2 text-sm font-medium px-4 py-2 text-white"
          style={{
            transform: "translateX(-50%)",
            backgroundColor: NAVY,
            borderRadius: "6px",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          {tooltip}
        </div>
      )}

      {/* Section header */}
      <p className="text-center" style={{ color: NAVY, fontWeight: 600, fontSize: "18px" }}>
        Share Your Achievement
      </p>

      {/* Social icons row */}
      <div className="flex flex-wrap justify-center gap-3">
        {buttons.map((btn) =>
          btn.href ? (
            <a
              key={btn.label}
              href={btn.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${btn.label}`}
              className="flex items-center justify-center shrink-0"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                backgroundColor: btn.bg,
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {btn.icon}
            </a>
          ) : (
            <button
              key={btn.label}
              onClick={btn.onClick}
              aria-label={`Share on ${btn.label}`}
              className="flex items-center justify-center shrink-0"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                backgroundColor: btn.bg,
                border: "none",
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {btn.icon}
            </button>
          )
        )}
      </div>

      {/* Caption */}
      <p className="text-center italic" style={{ color: "#bbb", fontSize: "12px" }}>
        Let the world see what you can do
      </p>

      {/* Back to simulations */}
      <a
        href="/simulations"
        className="text-sm font-medium px-8 py-3.5 text-center"
        style={{ border: `1px solid ${NAVY}`, color: NAVY, backgroundColor: "#fff" }}
      >
        Back to Simulations
      </a>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatIssuanceDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Claiming animation ─────────────────────────────────────────

const CLAIMING_STAGES = [
  "Verifying your work...",
  "Generating your credential...",
  "Sending to your inbox...",
] as const;

function ClaimingAnimation() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (stageIndex >= CLAIMING_STAGES.length - 1) return;
    const timer = setTimeout(() => {
      setStageIndex((i) => Math.min(i + 1, CLAIMING_STAGES.length - 1));
    }, 1200);
    return () => clearTimeout(timer);
  }, [stageIndex]);

  return (
    <div className="flex flex-col items-center gap-4 py-5 w-full">
      <style>{`
        @keyframes cb-claim-bar {
          0%   { left: -45%; width: 45%; }
          100% { left: 110%; width: 45%; }
        }
        @keyframes cb-badge-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.1); opacity: 0.75; }
        }
      `}</style>
      <svg
        width="30" height="30" viewBox="0 0 24 24" fill="none"
        stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: "cb-badge-pulse 1.8s ease-in-out infinite" }}
      >
        <circle cx="12" cy="8" r="6" />
        <path d="M8.56,17.39L7,22l5-3,5,3-1.56-4.61" />
      </svg>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          height: "3px",
          width: "220px",
          backgroundColor: "#E5E7EB",
          borderRadius: "9999px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            backgroundColor: TEAL,
            borderRadius: "9999px",
            animation: "cb-claim-bar 1.4s ease-in-out infinite",
          }}
        />
      </div>
      <p className="text-sm font-medium" style={{ color: NAVY, minHeight: "20px" }}>
        {CLAIMING_STAGES[stageIndex]}
      </p>
      <div className="flex gap-2">
        {CLAIMING_STAGES.map((_, i) => (
          <div
            key={i}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: i <= stageIndex ? TEAL : "#E5E7EB",
              transition: "background-color 0.4s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Credential card (post-claim) ───────────────────────────────

function CredentialCard({
  credentialUrl,
  imageUrl,
  recipientName,
  simulationTitle,
  verdictBand,
  issueDate,
}: {
  credentialUrl: string | null;
  imageUrl: string | null;
  recipientName: string;
  simulationTitle: string;
  verdictBand: string;
  issueDate: string;
}) {
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${simulationTitle} Credential`,
          text: `I earned a Career Bridge verified credential for ${simulationTitle}`,
          url: credentialUrl ?? undefined,
        });
        return;
      } catch { /* cancelled or unsupported */ }
    }
    try {
      await navigator.clipboard.writeText(credentialUrl ?? "");
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch { /* ignore */ }
  }

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: "6px", overflow: "hidden", width: "100%" }}>
      {/* Thumbnail */}
      <div
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #00568a 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: imageUrl ? "0" : "48px 24px",
          overflow: "hidden",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Credential"
            style={{ maxHeight: "240px", width: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <p
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Portfolio Simulations Credential
          </p>
        )}
      </div>

      {/* Card body */}
      <div className="px-6 py-5 flex flex-col gap-1.5">
        <p className="text-xl font-bold" style={{ color: NAVY }}>{recipientName || "Candidate"}</p>
        <p className="text-sm font-semibold" style={{ color: TEAL }}>
          {simulationTitle.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
        </p>
        <p className="text-sm font-semibold" style={{ color: TEAL }}>{verdictBand}</p>
        <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>Issued {issueDate}</p>
      </div>

      {/* Email confirmation banner */}
      <div
        className="px-6 py-3 flex items-start gap-2.5 text-sm text-white"
        style={{ backgroundColor: TEAL }}
      >
        <span style={{ flexShrink: 0 }}>📧</span>
        <span>A copy has been sent to your inbox — please check your email</span>
      </div>

      {/* Action buttons */}
      <div
        className="px-5 py-4 flex flex-wrap gap-3"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        {credentialUrl ? (
          <a
            href={credentialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold px-5 py-2.5 text-white text-center"
            style={{ backgroundColor: NAVY, borderRadius: "4px", flex: "1 1 auto" }}
          >
            View Full Credential
          </a>
        ) : (
          <span className="text-sm" style={{ color: "#888", flex: "1 1 auto", alignSelf: "center" }}>
            Credential issued — link will appear shortly
          </span>
        )}
        <button
          onClick={handleShare}
          className="text-sm font-medium px-5 py-2.5 text-center"
          style={{
            border: `1px solid ${NAVY}`,
            color: linkCopied ? TEAL : NAVY,
            borderRadius: "4px",
            flex: "1 1 auto",
            cursor: "pointer",
            background: "white",
            transition: "color 0.2s",
          }}
        >
          {linkCopied ? "Link copied!" : "Share"}
        </button>
      </div>
    </div>
  );
}

// ── Main results page ─────────────────────────────────────────────

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const simulationId = params?.id ?? "product-strategy";
  const sessionId = searchParams?.get("session_id") ?? null;
  const submissionWarning = searchParams?.get("warning") ?? null;

  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [credentialState, setCredentialState] = useState<"idle" | "claiming" | "claimed" | "error">("idle");
  const [credentialUrl, setCredentialUrl] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [showCredentialToast, setShowCredentialToast] = useState(false);
  const [recipientName, setRecipientName] = useState<string>("");
  const [credentialImageUrl, setCredentialImageUrl] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState<string>("");

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      // Authenticated path: load directly from Supabase using session_id
      if (sessionId) {
        const data = await loadEvaluationResultFromSupabase(sessionId);
        if (data) {
          setResult(data);
          setLoading(false);

          // Check for an existing credential issuance
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const [{ data: issuance }, { data: profile }] = await Promise.all([
              supabase
                .from("credential_issuances")
                .select("certifier_credential_url, status, issued_at")
                .eq("candidate_user_id", user.id)
                .eq("simulation_id", simulationId)
                .maybeSingle(),
              supabase
                .from("profiles")
                .select("full_name")
                .eq("id", user.id)
                .maybeSingle(),
            ]);
            const name = (profile as { full_name?: string } | null)?.full_name
              ?? user.email?.split("@")[0]
              ?? "Candidate";
            setRecipientName(name);
            if (issuance?.status === "issued" && issuance.certifier_credential_url) {
              setCredentialUrl(issuance.certifier_credential_url);
              setCredentialState("claimed");
              const rawDate = (issuance as { issued_at?: string }).issued_at;
              setIssueDate(formatIssuanceDate(rawDate ? new Date(rawDate) : new Date()));
            }
          }
          return;
        }
      }

      // Unauthenticated path: try localStorage immediately
      const localData = loadEvaluationResult(simulationId);
      if (localData) {
        setResult(localData);
        setLoading(false);
        return;
      }

      // Poll localStorage briefly to handle redirect race for unauthenticated users
      pollInterval = setInterval(() => {
        const data = loadEvaluationResult(simulationId);
        if (data) {
          setResult(data);
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 500);

      pollTimeout = setTimeout(() => {
        if (pollInterval) clearInterval(pollInterval);
        setLoading(false);
      }, 60000);
    }

    load().catch(console.error);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [simulationId, sessionId]);

  async function handleClaimCredential() {
    if (!sessionId) return;
    console.log("[claim] Button clicked, state =", credentialState);
    setCredentialState("claiming");
    setCredentialError(null);

    const MIN_DURATION_MS = 3600;
    const startTime = Date.now();

    try {
      console.log("[claim] State set to claiming, calling API...");
      const claimResult = await claimCredential(sessionId);
      console.log("[claim] API returned, response =", JSON.stringify(claimResult));

      const { credentialUrl: url, imageUrl } = claimResult;

      // Enforce minimum animation duration so all three stages are visible.
      const remaining = MIN_DURATION_MS - (Date.now() - startTime);
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }

      setCredentialUrl(url);
      setCredentialImageUrl(imageUrl);
      setIssueDate(formatIssuanceDate(new Date()));
      setCredentialState("claimed");
      console.log("[claim] State set to claimed, credentialUrl =", url);
      setShowCredentialToast(true);
      setTimeout(() => setShowCredentialToast(false), 4000);
    } catch (err) {
      console.log("[claim] Caught error:", err);
      setCredentialError(err instanceof Error ? err.message : "Something went wrong.");
      setCredentialState("error");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  if (loading) return <EvaluatingScreen />;
  if (!result) return <ErrorScreen simulationId={simulationId} />;

  const bandIndex = verdictBandIndex(result.verdict);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {showCredentialToast && (
        <div
          className="fixed top-6 left-1/2 z-50 flex items-center gap-2.5 px-5 py-3 text-white text-sm font-medium"
          style={{
            transform: "translateX(-50%)",
            backgroundColor: "#10B981",
            borderRadius: "6px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Credential issued successfully!
        </div>
      )}
      <Header variant="solid" />

      {submissionWarning && (
        <div className="border-b" style={{ borderColor: BORDER, backgroundColor: "#FAFAFA" }}>
          <div className="w-full max-w-[900px] mx-auto px-6 md:px-12 py-4">
            <p className="text-sm" style={{ color: NAVY, lineHeight: 1.7 }}>
              <span className="font-semibold">Submission note:</span> {submissionWarning}
            </p>
          </div>
        </div>
      )}

      <main
        className="flex-1 w-full max-w-[900px] mx-auto px-6 md:px-12 pb-20"
        style={{ paddingTop: "calc(73px + 3rem)" }}
      >

        {/* ── TOP SECTION ───────────────────────────────────────── */}
        <div className="mb-14">

          {/* 1. Simulation identity */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-1" style={{ color: NAVY }}>
              {SIM.title}
            </h1>
            <p className="text-sm" style={{ color: "#aaa" }}>
              {SIM.company} · {SIM.industry}
            </p>
            <div className="mt-6 h-px" style={{ backgroundColor: BORDER }} />
          </div>

          {/* 2. Verdict band indicator */}
          <div className="mb-8">
            {/* 5-segment bar with pointer */}
            <div className="flex gap-1">
              {BANDS.map((band, i) => {
                const active = i === bandIndex;
                return (
                  <div key={band.label} className="flex-1 flex flex-col items-center gap-2">
                    {/* Pointer arrow above active segment */}
                    <div style={{ height: "12px", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                      {active && (
                        <svg width="12" height="10" viewBox="0 0 12 10">
                          <polygon points="6,10 0,0 12,0" fill={band.color} />
                        </svg>
                      )}
                    </div>
                    {/* Segment bar */}
                    <div
                      style={{
                        height: "10px",
                        width: "100%",
                        backgroundColor: band.color,
                        opacity: active ? 1 : 0.2,
                        borderRadius: "3px",
                      }}
                    />
                    {/* Label below */}
                    <span
                      className="text-center block"
                      style={{
                        fontSize: "10px",
                        fontWeight: active ? 700 : 400,
                        color: active ? band.color : "#bbb",
                        lineHeight: 1.3,
                      }}
                    >
                      {band.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Verdict label + description */}
            <div className="mt-7">
              <p className="text-2xl font-bold mb-2" style={{ color: BANDS[bandIndex].color }}>
                {result.verdict === "Pass with Merit" ? "Merit" : result.verdict}
              </p>
              <p className="text-sm" style={{ color: "#666", lineHeight: 1.75, maxWidth: "720px" }}>
                {result.verdictDescription.replace(/\s*Credential issued\.?$/i, "").trim()}
              </p>
            </div>

            {/* Understated score */}
            <p className="text-sm mt-3" style={{ color: "#bbb" }}>
              Capability Score: {result.overallScore} out of {result.maxScore}
            </p>
          </div>

          {/* 3. Credential section */}
          {credentialState === "claimed" ? (
            <CredentialCard
              credentialUrl={credentialUrl}
              imageUrl={credentialImageUrl}
              recipientName={recipientName}
              simulationTitle={SIM.title}
              verdictBand={result.verdict === "Pass with Merit" ? "Merit" : result.verdict}
              issueDate={issueDate}
            />
          ) : (
            <div className="p-6" style={{ border: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-4">
                {/* Credential icon */}
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={result.credentialIssued ? TEAL : "#bbb"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 mt-0.5"
                >
                  <circle cx="12" cy="8" r="6" />
                  <path d="M8.56,17.39L7,22l5-3,5,3-1.56-4.61" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-2" style={{ color: NAVY }}>
                    Portfolio Verification: {SIM.title} — {SIM.industry}
                  </p>
                  {result.credentialIssued ? (
                    <>
                      {credentialState !== "claiming" && (
                        <p className="text-sm mb-5" style={{ color: "#555", lineHeight: 1.75 }}>
                          You are eligible to claim your verified digital credential at this
                          level. You may also choose to retake the simulation to aim for a
                          higher band.
                        </p>
                      )}
                      <div className="flex flex-col gap-3">
                        {credentialState === "claiming" ? (
                          <ClaimingAnimation />
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {!sessionId ? (
                              <span className="text-sm" style={{ color: "#888" }}>
                                Sign in to claim your credential.
                              </span>
                            ) : (
                              <button
                                onClick={handleClaimCredential}
                                className="text-sm font-semibold px-6 py-3 text-white"
                                style={{ backgroundColor: TEAL, cursor: "pointer" }}
                              >
                                {credentialState === "error" ? "Try Again →" : "Claim My Credential →"}
                              </button>
                            )}
                            <a
                              href={`/simulate/${simulationId}`}
                              className="text-sm font-medium px-6 py-3"
                              style={{ border: `1px solid ${NAVY}`, color: NAVY }}
                            >
                              Retake Simulation
                            </a>
                          </div>
                        )}
                        {credentialState === "error" && credentialError && (
                          <p className="text-xs" style={{ color: "#EF4444" }}>{credentialError}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm mb-5" style={{ color: "#555", lineHeight: 1.75 }}>
                        This level does not qualify for a credential. Review the feedback
                        below and retake the simulation when you are ready.
                      </p>
                      <div className="flex flex-wrap items-center gap-4">
                        <a
                          href={`/simulate/${simulationId}`}
                          className="text-sm font-semibold px-6 py-3 text-white"
                          style={{ backgroundColor: NAVY }}
                        >
                          Retake Simulation
                        </a>
                        <span className="text-xs" style={{ color: "#bbb" }}>
                          You may retry in 7 days
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── TASK BREAKDOWN ────────────────────────────────────── */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-6 h-px" style={{ backgroundColor: TEAL }} />
            <h2
              className="text-xs font-semibold uppercase"
              style={{ color: TEAL, letterSpacing: "0.16em" }}
            >
              Completed Activities
            </h2>
          </div>

          {result.tasks.map((task, i) => (
            <TaskCard
              key={task.taskId}
              task={task}
              index={i}
              defaultOpen={i === 0}
            />
          ))}
        </div>

        {/* ── ACTIONS ───────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          {result.credentialIssued ? (
            <ShareSection result={result} />
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <a
                href={`/simulate/${simulationId}`}
                className="text-sm font-semibold px-8 py-3.5 text-white text-center"
                style={{ backgroundColor: NAVY }}
              >
                Retry Simulation
              </a>
              <a
                href="/simulations"
                className="text-sm font-medium px-8 py-3.5 text-center"
                style={{ border: `1px solid ${NAVY}`, color: NAVY, backgroundColor: "#fff" }}
              >
                Back to Simulations
              </a>
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
}

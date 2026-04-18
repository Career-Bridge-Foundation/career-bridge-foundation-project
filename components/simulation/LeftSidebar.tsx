import { cn } from "@/lib/cn";
import type { Prompt } from "@/types";

interface LeftSidebarProps {
  simulationTitle: string;
  simulationCompany: string;
  simulationIndustry: string;
  prompts: Prompt[];
  currentStep: number;
  lastSavedText: () => string;
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" className="fill-teal" />
      <polyline
        points="4,8 7,11 12,5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function LeftSidebar({
  simulationTitle,
  simulationCompany,
  simulationIndustry,
  prompts,
  currentStep,
  lastSavedText,
}: LeftSidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-[280px] shrink-0 sticky self-start overflow-y-auto top-[73px] h-[calc(100vh-73px)] border-r border-border-light">
      <div className="p-6 flex flex-col gap-6 h-full">

        {/* Simulation info */}
        <div>
          <span className="text-xs font-semibold uppercase text-teal tracking-brand-md block mb-2">
            This Assessment
          </span>
          <h2 className="text-base font-bold text-navy mb-1">{simulationTitle}</h2>
          <p className="text-xs text-[#888] mb-3">
            {simulationCompany} · {simulationIndustry}
          </p>
          {/* Credential badge */}
          <div className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal">
              <circle cx="12" cy="8" r="6" />
              <path d="M8.56,17.39L7,22l5-3,5,3-1.56-4.61" />
            </svg>
            <span className="text-xs font-medium text-teal">Earns a verified credential</span>
          </div>
          <div className="mt-4 h-px bg-border-light" />
        </div>

        {/* Progress steps */}
        <div className="flex-1">
          <span className="text-xs font-semibold uppercase text-navy tracking-brand-sm block mb-4">
            Assessment Tasks
          </span>
          <div className="flex flex-col gap-4">
            {prompts.map((p, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={p.id} className="flex items-start gap-3">
                  {/* Status indicator */}
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircleIcon />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-teal flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-teal" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#ddd]" />
                    )}
                  </div>
                  <div>
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-brand-sm block",
                        isCurrent ? "text-teal" : isCompleted ? "text-[#888]" : "text-[#ccc]"
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "text-xs leading-snug",
                        isCurrent
                          ? "text-navy font-semibold"
                          : isCompleted
                          ? "text-[#888]"
                          : "text-[#bbb]"
                      )}
                    >
                      {p.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Credential note */}
        <p className="text-xs italic text-[#bbb] leading-relaxed">
          Complete all tasks to earn your verified Career Bridge credential for this simulation.
        </p>

        {/* Save status */}
        <div className="pt-4 border-t border-border-light">
          <p className="text-xs italic text-[#bbb]">Last saved: {lastSavedText()}</p>
        </div>
      </div>
    </aside>
  );
}

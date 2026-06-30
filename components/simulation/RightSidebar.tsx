import type { Prompt } from "@/types";

interface RightSidebarProps {
  prompt: Prompt;
  currentStep: number;
  timeRemaining: number[];
}

export function RightSidebar({ prompt, currentStep, timeRemaining }: RightSidebarProps) {
  return (
    <aside className="hidden xl:flex flex-col w-[240px] shrink-0 sticky self-start overflow-y-auto top-[73px] h-[calc(100vh-73px)] border-l border-border-light">
      <div className="p-5 flex flex-col gap-4">

        {/* Task guidance */}
        <div className="p-4 border border-border-light">
          <span className="text-xs font-semibold uppercase text-teal tracking-brand-md block mb-2">
            Task Guidance
          </span>
          <h4 className="text-sm font-bold text-navy leading-[1.35] mb-3">{prompt.title}</h4>
          <ul className="flex flex-col gap-2.5">
            {prompt.guidance.map((g, i) => (
              <li key={i} className="flex gap-2 text-xs text-[#555] leading-relaxed">
                <span className="shrink-0 font-bold text-teal">—</span>
                {g}
              </li>
            ))}
          </ul>
        </div>

        {/* Need support */}
        <div className="p-4 bg-grey-bg">
          <span className="text-xs font-semibold uppercase text-[#aaa] tracking-brand-md block mb-2">
            Need Support?
          </span>
          <p className="text-xs text-[#666] leading-[1.75] mb-3">
            Our team is here to help. Reach out if you have any questions about this simulation.
          </p>
          <a
            href="mailto:support@careerbridgefoundation.zohodesk.eu"
            className="text-xs font-medium text-teal"
          >
            Contact support →
          </a>
        </div>

        {/* Time estimate */}
        <div className="p-4 border border-border-light flex items-center gap-2">
          {/* Clock icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xs text-[#888]">
            Approx {timeRemaining[currentStep]} mins remaining
          </span>
        </div>

        {/* AI Debrief indicator */}
        <div className="p-4 border border-teal/30 bg-teal/5 rounded-sm">
          <div className="flex items-center gap-2 mb-2">
            {/* Mic icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4DC5D2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="9" y1="22" x2="15" y2="22" />
            </svg>
            <span className="text-xs font-semibold uppercase text-teal tracking-brand-md">
              AI Debrief
            </span>
            <span className="ml-auto text-[10px] font-medium text-teal/70 bg-teal/10 px-1.5 py-0.5 rounded-full leading-none">
              Optional
            </span>
          </div>
          <p className="text-xs text-[#666] leading-[1.7]">
            After you receive your feedback, you can speak with an AI coach to explore your results and deepen your learning.
          </p>
        </div>

      </div>
    </aside>
  );
}

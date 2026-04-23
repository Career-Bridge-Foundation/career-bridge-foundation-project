// import { StatusBadge } from "@/components/ui/Badge";
import type { Discipline } from "@/types";

interface DisciplineCardProps {
  discipline: Discipline;
}

export function DisciplineCard({ discipline: d }: DisciplineCardProps) {
  return (
    <div className="discipline-card bg-white p-8 flex flex-col">
      {/* Status badge */}
      {/* <div className="mb-5">
        <StatusBadge status={d.status} />
      </div> */}

      {/* Name + description */}
      <h3 className="text-lg font-bold text-navy leading-[1.3] mb-3">{d.name}</h3>
      <p className="text-sm text-[#555] leading-[1.75] flex-1">{d.description}</p>

      {/* Divider + bottom row */}
      <div className="mt-7 pt-5 flex items-center justify-between border-t border-border-light">
        {d.status === "available" ? (
          <>
            <span className="text-sm text-[#999]">{d.count}</span>
            <a href={d.href} className="text-sm font-medium text-teal hover:underline">
              Start Practicing →
            </a>
          </>
        ) : (
          <>
            <span className="text-sm text-[#ccc]">Coming Soon</span>
            <span className="text-sm font-medium text-teal">Join The Waitlist →</span>
          </>
        )}
      </div>
    </div>
  );
}

import { cn } from "@/lib/cn";

interface DifficultyBadgeProps {
  level: "Foundation" | "Practitioner" | "Advanced";
}

/** Coloured badge for simulation difficulty level. */
export function DifficultyBadge({ level }: DifficultyBadgeProps) {
  const classes =
    level === "Foundation"
      ? "text-green-600 border-green-600"
      : level === "Practitioner"
      ? "text-amber-600 border-amber-600"
      : "text-navy border-navy";

  return (
    <span
      className={cn(
        "text-xs font-semibold uppercase px-2.5 py-1 border tracking-brand-sm",
        classes
      )}
    >
      {level}
    </span>
  );
}

interface StatusBadgeProps {
  status: "available" | "coming-soon";
}

/** Teal "Available Now" / grey "Coming Soon" badge for discipline cards. */
export function StatusBadge({ status }: StatusBadgeProps) {
  return status === "available" ? (
    <span className="text-xs font-semibold uppercase px-3 py-1.5 border border-teal text-teal tracking-brand-md">
      Available Now
    </span>
  ) : (
    <span className="text-xs font-semibold uppercase px-3 py-1.5 border border-[#ccc] text-[#aaa] tracking-brand-md">
      Coming Soon
    </span>
  );
}

interface TypeBadgeProps {
  type: string;
}

/** Teal outlined badge for simulation scenario type. */
export function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <span className="text-xs font-semibold uppercase px-2.5 py-1 border border-teal text-teal tracking-brand-sm">
      {type}
    </span>
  );
}

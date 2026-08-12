"use client";

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase text-navy tracking-brand-sm">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="filter-select text-sm px-3 py-2.5 bg-white border border-border-light text-navy min-w-[180px]"
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

/* Fallback option sets — the full platform-wide vocabulary. Pages that do not
 * pass explicit options keep the historical behaviour of showing every tier,
 * type and industry regardless of what their query returned. Prefer passing
 * options derived from the returned rows: a hardcoded option with no matching
 * simulation dead-ends the candidate on "No simulations match your filters."
 * See app/(branded)/simulations/business-analysis/page.tsx for the pattern. */
const DEFAULT_TYPE_OPTIONS = [
  "All", "Strategy", "Discovery", "Delivery", "Go-to-Market", "Analysis", "Stakeholder",
];
const DEFAULT_DIFF_OPTIONS = ["All", "Foundation", "Practitioner", "Advanced"];
const DEFAULT_INDUSTRY_OPTIONS = [
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
];

interface FilterBarProps {
  typeFilter: string;
  diffFilter: string;
  industryFilter: string;
  onTypeChange: (v: string) => void;
  onDiffChange: (v: string) => void;
  onIndustryChange: (v: string) => void;
  onClear: () => void;
  hasActiveFilter: boolean;
  /** Option lists, each including the leading "All". Omit to fall back to the
   *  full platform-wide vocabulary above. */
  typeOptions?: string[];
  diffOptions?: string[];
  industryOptions?: string[];
}

export function FilterBar({
  typeFilter,
  diffFilter,
  industryFilter,
  onTypeChange,
  onDiffChange,
  onIndustryChange,
  onClear,
  hasActiveFilter,
  typeOptions = DEFAULT_TYPE_OPTIONS,
  diffOptions = DEFAULT_DIFF_OPTIONS,
  industryOptions = DEFAULT_INDUSTRY_OPTIONS,
}: FilterBarProps) {
  return (
    <div className="bg-white px-6 py-6 border-b border-border-light">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
        <FilterSelect
          label="Scenario Type"
          value={typeFilter}
          options={typeOptions}
          onChange={onTypeChange}
        />
        <FilterSelect
          label="Difficulty"
          value={diffFilter}
          options={diffOptions}
          onChange={onDiffChange}
        />
        <FilterSelect
          label="Industry"
          value={industryFilter}
          options={industryOptions}
          onChange={onIndustryChange}
        />

        {/* Clear filters */}
        <div className="sm:ml-auto flex items-end pb-0.5">
          {hasActiveFilter ? (
            <button onClick={onClear} className="text-sm font-medium text-teal">
              Clear filters
            </button>
          ) : (
            <span className="text-sm text-transparent">Clear filters</span>
          )}
        </div>
      </div>
    </div>
  );
}

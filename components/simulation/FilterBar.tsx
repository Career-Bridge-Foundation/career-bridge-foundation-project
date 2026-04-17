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

interface FilterBarProps {
  typeFilter: string;
  diffFilter: string;
  industryFilter: string;
  onTypeChange: (v: string) => void;
  onDiffChange: (v: string) => void;
  onIndustryChange: (v: string) => void;
  onClear: () => void;
  hasActiveFilter: boolean;
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
}: FilterBarProps) {
  return (
    <div className="bg-white px-6 py-6 border-b border-border-light">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
        <FilterSelect
          label="Scenario Type"
          value={typeFilter}
          options={["All", "Strategy", "Discovery", "Delivery", "Go-to-Market", "Analysis", "Stakeholder"]}
          onChange={onTypeChange}
        />
        <FilterSelect
          label="Difficulty"
          value={diffFilter}
          options={["All", "Foundation", "Practitioner", "Advanced"]}
          onChange={onDiffChange}
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

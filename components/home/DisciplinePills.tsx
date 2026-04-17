const DISCIPLINES = [
  "Product Management",
  "Project Management",
  "Cyber Security",
  "Cloud DevOps",
  "Customer Service",
  "Healthcare Assistance",
  "Data Analytics",
  "SEO Analysis",
  "Business Analysis",
];

export function DisciplinePills() {
  return (
    <section id="simulations" className="py-28 px-6 bg-grey-bg">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-teal" />
          <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
            Career Simulation Disciplines
          </span>
        </div>

        <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-5">
          Prove Your Capability
        </h2>

        <p className="text-sm font-light text-[#555] leading-[1.75] mb-12 md:whitespace-nowrap">
          Workplace simulations across multiple disciplines, built around real industry scenarios
          and verified by practitioners.
        </p>

        {/* Discipline pills */}
        <div className="flex flex-wrap gap-3 mb-12">
          {DISCIPLINES.map((discipline) => (
            <a
              key={discipline}
              href="/simulations"
              className="discipline-pill text-xs font-medium uppercase px-5 py-3 border border-border-light text-navy tracking-brand-sm"
            >
              {discipline}
            </a>
          ))}
        </div>

        {/* CTA button */}
        <a
          href="/simulations"
          className="inline-flex items-center px-7 py-3.5 text-sm font-medium text-white bg-navy"
        >
          Explore All Simulations →
        </a>
      </div>
    </section>
  );
}

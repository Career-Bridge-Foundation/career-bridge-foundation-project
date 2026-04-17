const steps = [
  {
    num: "01",
    title: "Enter your simulation",
    desc: "You land inside a realistic workplace scenario at a simulated organisation built around your chosen discipline. Watch the project briefing from a senior colleague, understand the scenario context, and the task or expected deliverable you have been given.",
  },
  {
    num: "02",
    title: "Do the work",
    desc: "Complete your tasks as you would working within your simulated organisation. Provide your completed work as written responses, upload documents, or share deliverables from your preferred tools. You demonstrate your thinking, mindset and approach, not just answers.",
  },
  {
    num: "03",
    title: "Prove Your Work Experience",
    desc: "Receive a detailed evaluation breakdown and feedback on your completed simulation tasks. You will obtain shareable evidence for your digital portfolio and a verifiable digital credential that employers can trust.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-28 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-teal" />
          <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
            The Process
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-16">
          How it works
        </h2>

        {/* Cards — 1px gap acts as divider via bg-border-light parent */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border-light">
          {steps.map(({ num, title, desc }) => (
            <div key={num} className="relative bg-white p-10 flex flex-col">
              {/* Teal dot accent */}
              <div className="absolute top-8 right-8 w-2 h-2 rounded-full bg-teal" />

              {/* Number */}
              <span className="text-xs font-semibold uppercase text-teal tracking-brand-xl mb-7">
                {num}
              </span>

              <h3 className="text-base font-bold text-navy leading-[1.4] mb-4">{title}</h3>

              <p className="text-sm text-[#666] leading-[1.75] flex-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

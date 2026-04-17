export function PartnersSection() {
  return (
    <section className="py-28 px-6 text-center bg-navy">
      <div className="max-w-2xl mx-auto flex flex-col items-center gap-7">
        {/* Label with side lines */}
        <div className="flex items-center justify-center gap-4">
          <div className="w-8 h-px bg-white/25" />
          <span className="text-xs font-medium uppercase text-white/50 tracking-brand-xl">
            Our Partners
          </span>
          <div className="w-8 h-px bg-white/25" />
        </div>

        <h2 className="text-3xl md:text-4xl font-bold text-white leading-heading">
          Trusted by Academic and Professional Training Institutions
        </h2>

        <p className="text-base font-light text-white/[0.68] leading-[1.8] max-w-lg">
          Career Bridge Foundation works with leading academic institutions and professional
          training organisations to deliver portfolio simulations that help candidates
          demonstrate real-world capability and stand out in competitive job markets.
        </p>

        <span className="text-xs font-medium uppercase text-white border border-white/45 px-6 py-3 tracking-brand-sm">
          Academic &amp; Professional Training Institutions
        </span>
      </div>
    </section>
  );
}

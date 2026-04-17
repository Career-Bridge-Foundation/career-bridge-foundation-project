export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center px-6 bg-navy">
      {/* Dot grid overlay */}
      <div className="hero-dot-grid absolute inset-0 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto w-full pt-24 pb-20">
        {/* Teal line + label */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-px bg-teal" />
          <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
            Portfolio Simulations
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-bold leading-hero">
          <span className="block text-[clamp(2rem,4vw,3.5rem)] text-white whitespace-nowrap">
            Prove what you can do.
          </span>
          <span className="block text-[clamp(2rem,4vw,3.5rem)] text-teal whitespace-nowrap">
            Not just what you know.
          </span>
        </h1>

        {/* Subheading */}
        <p className="mt-7 text-base md:text-lg font-light text-white/[0.72] leading-[1.75] max-w-[700px]">
          Complete realistic workplace simulations, receive AI-evaluated feedback, and
          build a portfolio of evidence that employers actually trust.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <a
            href="#simulations"
            className="btn-hero-primary inline-flex items-center justify-center px-8 py-3.5 text-sm font-medium uppercase"
          >
            Start a Simulation
          </a>
          <a
            href="#how-it-works"
            className="btn-hero-secondary inline-flex items-center justify-center px-8 py-3.5 text-sm font-medium uppercase"
          >
            See how it works
          </a>
        </div>

        {/* Trust signals */}
        <div className="mt-14 flex flex-col sm:flex-row gap-6 sm:gap-12">
          {["AI-evaluated feedback", "Shareable portfolio output"].map((item) => (
            <span
              key={item}
              className="text-xs font-medium uppercase text-white/45 tracking-brand-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const testimonials = [
  {
    quote:
      "Career Bridge has been a turning point in my career. The simulated work gave me the opportunity to apply agile principles in real projects, sharpen my coaching and facilitation skills, and accelerate my development in a way traditional learning never could.",
    name: "Henry A.",
    role: "Scrum Master",
  },
  {
    quote:
      "The simulated work experience had a real impact on my skills. I improved my time management, built my communication confidence, and worked across more formats and platforms than I ever had before. It changed how I show up professionally.",
    name: "Olena A.",
    role: "Product Interaction Designer",
  },
  {
    quote:
      "From day one I was trusted with real responsibilities. The hands-on experience I gained is something I would not trade for anything. It built my confidence, pushed me out of my comfort zone, and gave me practical skills no textbook could have taught me.",
    name: "Sanyu S.",
    role: "HR and Performance Analyst",
  },
];

export function Testimonials() {
  return (
    <section className="bg-white py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-px bg-teal" />
          <span className="text-xs font-medium uppercase text-teal tracking-brand-xl">
            Candidate Stories
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-navy leading-heading mb-16">
          What candidates say
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border-light">
          {testimonials.map(({ quote, name, role }) => (
            <div key={name} className="bg-white p-10">
              <span className="block font-serif text-teal text-[4.5rem] leading-none mb-6">
                &ldquo;
              </span>
              <p className="text-base text-[#444] leading-[1.8]">{quote}</p>
              <div className="mt-8 pt-8 border-t border-border-light">
                <span className="block font-bold text-sm text-navy">{name}</span>
                <span className="block text-xs uppercase text-[#aaa] tracking-brand-sm mt-1">
                  {role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

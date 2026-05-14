import type { Metadata } from "next";
import { getDisciplines } from "@/lib/requests";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { DisciplinePills } from "@/components/home/DisciplinePills";
import { Testimonials } from "@/components/home/Testimonials";
import { PartnersSection } from "@/components/home/PartnersSection";


export const metadata: Metadata = {
  title: "Career Bridge Foundation — Portfolio Simulations",
  description:
    "Prove your capability through realistic, scenario-based assessments built for early-career professionals.",
};

export default async function Home() {
  const disciplines = await getDisciplines();

  return (
    <div className="min-h-screen">
      <Header homeMode />
      <HeroSection />
      <HowItWorks />
      <DisciplinePills disciplines={disciplines} />
      <Testimonials />
      <PartnersSection />
      <Footer />
    </div>
  );
}

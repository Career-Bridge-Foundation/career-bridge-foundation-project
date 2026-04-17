// import type { Metadata } from "next";
import type { Simulation } from "@/lib/types";
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
  let simulations: Simulation[] = [];

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/simulations`, {
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      simulations = json.simulations || [];
    }
  } catch (error) {
    console.error("Failed to fetch simulations:", error);
  }

  return (
    <div className="min-h-screen">
      <Header homeMode />
      <HeroSection />
      <HowItWorks />
      <DisciplinePills />
      <Testimonials />
      <PartnersSection />
      <Footer />
    </div>
  );
}

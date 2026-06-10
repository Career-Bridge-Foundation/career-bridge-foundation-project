import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { DisciplinePills } from "@/components/home/DisciplinePills";
import { Testimonials } from "@/components/home/Testimonials";
import { PartnersSection } from "@/components/home/PartnersSection";

export default function Home() {
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

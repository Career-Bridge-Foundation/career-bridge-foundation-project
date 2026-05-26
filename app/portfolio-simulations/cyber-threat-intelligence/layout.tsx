import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verified Cyber Threat Intelligence Work Portfolio — Career Bridge Foundation",
  description:
    "Prove you can do cyber threat intelligence work. Two weeks of real scenarios, expert-validated rubrics, a verified portfolio you own and share. Founding cohort places at $299.",
};

export default function CtiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

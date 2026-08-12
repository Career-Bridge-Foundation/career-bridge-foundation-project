import type { Discipline } from "@/types";

export const disciplines: Discipline[] = [
  {
    id: 1,
    name: "Product Management",
    slug: "product-management",
    description:
      "Prove your product thinking across strategy, discovery, and delivery through simulations verified by experienced product managers and industry practitioners.",
    status: "available",
    // HARDCODED TIER LABEL — not derived from published sims. Update by hand
    // when a new difficulty tier ships, together with the hero badge in
    // app/(branded)/simulations/product-management/page.tsx ("Difficulty: ...").
    count: "Foundation to Advanced",
    href: "/simulations/product-management",
    grantable: true,
  },
  {
    id: 2,
    name: "Project Management",
    slug: "project-management",
    description:
      "Stand out from the crowd with verified evidence of your project management capability. Real scenarios, real skills, real proof that goes beyond your CV.",
    status: "available",
    // HARDCODED TIER LABEL — not derived from published sims. Update by hand
    // when a new difficulty tier ships, together with the hero badge in
    // app/(branded)/simulations/project-management/page.tsx ("Difficulty: ...").
    count: "Foundation to Advanced",
    href: "/simulations/project-management",
    grantable: true,
  },
  {
    id: 3,
    name: "Cyber Security",
    slug: "cyber-security",
    description:
      "Simulations aligned to the UK Cyber Security Council Career Framework and verified by expert consultants. Build credible evidence for roles across the cyber security sector.",
    status: "available",
    // HARDCODED TIER LABEL — not derived from published sims. Update by hand
    // when a new difficulty tier ships, together with the hero badge in
    // app/(branded)/simulations/cyber-security/page.tsx ("Difficulty: ...").
    count: "Foundation to Advanced",
    href: "/simulations/cyber-security",
    grantable: true,
  },
  {
    id: 4,
    name: "Business Analysis",
    slug: "business-analysis",
    description:
      "Prove your ability to gather requirements, map processes, and communicate analysis through structured workplace simulations.",
    status: "available",
    // HARDCODED TIER LABEL — not derived from published sims. Update by hand
    // when a new difficulty tier ships, together with the hero badge in
    // app/(branded)/simulations/business-analysis/page.tsx ("Difficulty: ...").
    count: "Foundation to Advanced",
    href: "/simulations/business-analysis",
    grantable: true,
  },
  {
    id: 5,
    name: "Cloud DevOps",
    slug: "cloud-devops",
    description:
      "Build hands-on capability in cloud infrastructure, deployment pipelines, and DevOps practices through realistic workplace simulations.",
    status: "coming-soon",
    grantable: true,
  },
  {
    id: 6,
    name: "Customer Service",
    slug: "customer-service",
    description:
      "Develop the customer facing capabilities organisations are actively hiring for. Go beyond knowledge and demonstrate the skills that make you the candidate they want.",
    status: "coming-soon",
    grantable: true,
  },
  {
    id: 7,
    name: "Healthcare Assistance",
    slug: "healthcare-assistance",
    description:
      "Develop practical healthcare support skills through scenario based simulations aligned to real workplace expectations in the healthcare sector.",
    status: "coming-soon",
    grantable: true,
  },
  {
    id: 8,
    name: "Data Analytics",
    slug: "data-analytics",
    description:
      "Demonstrate your ability to analyse data, generate insights, and communicate findings through realistic business scenarios.",
    status: "coming-soon",
    grantable: true,
  },
  {
    id: 9,
    name: "SEO Analysis",
    slug: "seo-analysis",
    description:
      "Build and prove your digital marketing and SEO capability through practical simulations aligned to what employers are looking for.",
    status: "coming-soon",
    grantable: true,
  },
];

/** Disciplines partners may mint or grant (grantable === true). Deliberately
 *  separate from `status`: a discipline can be visible in the candidate
 *  catalogue without being grantable to partners. See issue #64 — there is no
 *  partner-offered set yet, so grants/mints validate against this global list.
 *
 *  Every mint/grant call site MUST derive from these two exports rather than
 *  re-filtering `disciplines` locally, or the two notions drift apart again. */
export const grantableDisciplines: Discipline[] = disciplines.filter(
  (d) => d.grantable === true
);

/** Grantable discipline NAMES — the shared grant/mint vocabulary, stored by name. */
export const availableDisciplineNames: string[] = grantableDisciplines.map(
  (d) => d.name
);

import type { PriceType } from "@/types/database";

type CheckoutPrice = {
  amount: number;
  name: string;
  quantity?: number;
  discount?: number; // discount in pence (e.g., 2000 = £20.00)
};

export type PricingPlan = {
  id: PriceType;
  title: string;
  price: string;
  description: string;
  badge?: string;
  features: string[];
  cta: string;
  ctaHref?: string;
  popular?: boolean;
  checkout: CheckoutPrice;
  simulationCredits: number;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "single",
    title: "Single Simulation",
    price: "£49.99",
    description: "one-off",
    features: [
      "1 workplace simulation",
      "AI-powered evaluation",
      "Detailed feedback report",
      "Digitally verifiable credential",
      "AI-powered simulation assistant",
    ],
    cta: "Get Started",
    checkout: {
      amount: 4999,
      name: "Career Bridge - Single Simulation",
    },
    simulationCredits: 1,
  },
  {
    id: "bundle",
    title: "Simulation Bundle",
    price: "£129.99",
    description: "save £20",
    features: [
      "3 workplace simulations",
      "AI-powered evaluation",
      "Detailed feedback reports",
      "Digitally verifiable credentials",
      "AI-powered simulation assistant",
      "Portfolio building across scenarios",
      "Access to Career Bridge community",
    ],
    cta: "Get Started",
    checkout: {
      amount: 4999,
      name: "Career Bridge - Bundle (3 Simulations)",
      quantity: 3,
      discount: 2000, // Save £20
    },
    simulationCredits: 3,
  },
  {
    id: "portfolio",
    title: "Complete Discipline",
    price: "£349.99",
    description: "one discipline, full depth",
    badge: "Most Popular",
    features: [
      "All simulations in your chosen discipline",
      "AI-powered evaluation",
      "Detailed feedback reports",
      "Digitally verifiable credentials",
      "AI-powered simulation assistant",
      "End-to-end discipline mastery",
      "Priority support",
      "Access to Career Bridge community",
    ],
    cta: "Get Started",
    popular: true,
    checkout: {
      amount: 34999,
      name: "Career Bridge - Full PM Portfolio (14 Simulations)",
    },
    simulationCredits: 14,
  },
  {
    id: "coach",
    title: "Coach Pack",
    price: "£1,499.99",
    description: "10 candidate seats",
    features: [
      "10 candidate access seats",
      "All simulations included",
      "Candidate progress dashboard",
      "Bulk credential issuance",
      "White-label ready",
      "Dedicated support",
      "Access to Career Bridge community",
    ],
    cta: "Contact Us",
    ctaHref: "mailto:outreach@careerbridgefoundation.com",
    checkout: {
      amount: 149999,
      name: "Career Bridge - Coach Licence (10 Seats)",
    },
    simulationCredits: 999,
  },
];

export const CHECKOUT_PRICES = PRICING_PLANS.reduce((acc, plan) => {
  acc[plan.id] = plan.checkout;
  return acc;
}, {} as Record<PriceType, CheckoutPrice>);

export const CREDIT_BY_PRICE_TYPE = PRICING_PLANS.reduce((acc, plan) => {
  acc[plan.id] = plan.simulationCredits;
  return acc;
}, {} as Record<PriceType, number>);

import type { Simulation } from '@/types/simulation'

const NEXUS_BANK_PM_V1: Simulation = {
  id: 'nexus-bank-pm-v1',
  title: 'Nexus Bank Startup Account: Product Strategy Simulation',
  company: 'Nexus Bank',
  discipline: 'Product Management',
  industry: 'Financial Services / Banking',
  candidateRole: 'Associate Product Manager',
  estimatedMinutes: '60–90 minutes',
  videoUrl: null, // set when HeyGen video is ready — see SPEC Section 8.3
  passingScore: 55,
  scenarioBrief: `It is early January. You have just joined Nexus Bank as an Associate Product Manager on a newly formed squad. The timing is not coincidental — in December, Nexus Bank ran a high-profile Christmas advertising campaign positioning itself as the go-to bank for ambitious startups. The response was overwhelming. Within two weeks, the customer service team logged over 1,400 inbound enquiries from founders, early-stage companies, and accelerator graduates asking about business transaction accounts.

The problem is simple and urgent: there is no product. There is interest, but no account that meaningfully serves startup needs. The CEO has now formally commissioned a cross-functional group to build one, and you are the Associate Product Manager responsible for shaping what it becomes. Your squad includes engineers, a UX designer, a compliance lead, and a data analyst. You have been given three months to deliver a product recommendation to the executive team.

You quickly discover that the internal team has no shared understanding of what startups actually need from a bank. Some stakeholders want to replicate a standard SME account with a lower fee. Others want to build deep integrations with accounting tools like Xero and QuickBooks. The Head of Commercial Banking insists that due diligence and compliance requirements cannot be relaxed. Meanwhile, two fintech competitors have launched dedicated startup accounts in the last six months and are gaining ground fast.

Your Challenge: Define the product strategy for this new startup account. Starting with research, you must identify what the market actually needs, how the competition is positioned, and what Nexus Bank can realistically build that will win. You have three prompts to work through. Each one tests a different part of your strategic thinking. Write clearly, think like a PM, and show your working.`,
  prompts: [
    {
      number: 1,
      title: 'Market Discovery',
      body: `Before you can define what the Nexus Bank startup account will offer, you need to understand the market. Describe the research process you would use to identify what startups actually need from a business bank account. Who would you speak to, what questions would you ask, and how would you validate your findings before using them to shape the product? Be specific about your methods and explain how you would prioritise the insights you gather.`,
      submissionType: 'typed',
      wordMin: 200,
      wordMax: 400,
    },
    {
      number: 2,
      title: 'Competitive Landscape',
      body: `Two fintech competitors — Starling and Tide — launched dedicated startup accounts in the last six months and are gaining traction. Using what you know about the startup banking market, analyse the competitive landscape. What are these competitors offering, where are their gaps, and what could Nexus Bank uniquely offer that they cannot? How does your competitive analysis inform the product positioning for this new account?`,
      submissionType: 'either',
      wordMin: 200,
      wordMax: 400,
    },
    {
      number: 3,
      title: 'Product Strategy Definition',
      body: `Based on your market research and competitive analysis, define the product strategy for the Nexus Bank startup account. What are the two or three core features you would prioritise for the first release, and why? How would you handle the tension between what startups want and what Nexus Bank's compliance and commercial teams will accept? What does success look like at six months post-launch, and how would you measure it?`,
      submissionType: 'url',
      wordMin: 200,
      wordMax: 400,
    },
  ],
}

const SIMULATIONS: Record<string, Simulation> = {
  [NEXUS_BANK_PM_V1.id]: NEXUS_BANK_PM_V1,
}

export function getSimulation(id: string): Simulation | null {
  return SIMULATIONS[id] ?? null
}

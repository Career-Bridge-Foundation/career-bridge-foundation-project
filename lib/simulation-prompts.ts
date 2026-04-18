// import type { Prompt } from "@/types";

// export const SIM = {
//   title: "Product Strategy",
//   company: "Nexus Bank",
//   industry: "Financial Services",
//   role: "Associate Product Manager",
// };

// export const BRIEF_SHORT =
//   "You are an Associate Product Manager at Nexus Bank. The business is launching a new startup-focused bank account and you have been brought in to define the product direction. You have two weeks before your first executive presentation.";

// export const BRIEF_FULL =
//   "You are an Associate Product Manager at Nexus Bank, one of the UK's established challenger banks. The executive team has identified a gap in the market: a business bank account designed specifically for early-stage startups. Two fintech competitors launched similar products six months ago and are gaining traction. Your task is to define what Nexus Bank's startup account should offer, why, and how. Over the next five tasks, you will conduct market discovery, analyse the competitive landscape, define the product strategy, plan your stakeholder communication, and produce a strategic summary. You have two weeks before your first executive presentation. Work methodically and show your thinking clearly.";

// export const VIDEO_TRANSCRIPT =
//   "Hi, welcome to the Nexus Bank Product Strategy simulation. I'm Sarah Chen, Head of Product here. We're really excited to have you on the team. So here's the situation — we've been watching the startup banking market closely for the last twelve months and we think there's a real opportunity for Nexus Bank to enter this space with a product that's genuinely different. Two competitors got there before us, but we believe their products have real gaps, especially for seed and pre-seed stage companies. Your job over the next two weeks is to help us figure out what our startup account should actually be. Don't just tell us what features to build — tell us what problems we're solving and why our approach will win. Start by getting into the market. Talk to people, look at the data, understand what startups actually need from a business bank account versus what they say they need. Good luck. I'm looking forward to seeing what you come up with.";

// export const PROMPTS: Prompt[] = [
//   {
//     id: 1,
//     type: "typed",
//     title: "Market Discovery",
//     question:
//       "Before you can define what the Nexus Bank startup account will offer, you need to understand the market. Describe the research process you would use to identify what startups actually need from a business bank account. Who would you speak to, what questions would you ask, and how would you validate your findings before using them to shape the product?",
//     guidance: [
//       "Consider both internal and external research sources",
//       "Think about who holds the most relevant knowledge inside Nexus Bank",
//       "Focus on validating assumptions not just gathering information",
//       "Quality of insight matters more than quantity of sources",
//     ],
//     minWords: 200,
//   },
//   {
//     id: 2,
//     type: "typed",
//     title: "Competitive Landscape",
//     question:
//       "Two fintech competitors launched dedicated startup accounts in the last six months and are gaining traction. Analyse the competitive landscape. What are these competitors offering, where are their gaps, and what could Nexus Bank uniquely offer that they cannot?",
//     guidance: [
//       "Go beyond surface level feature comparisons",
//       "Think about what startups value most at different growth stages",
//       "Consider what Nexus Bank can realistically offer that fintechs cannot",
//       "Connect your analysis directly to product decisions",
//     ],
//     minWords: 200,
//   },
//   {
//     id: 3,
//     type: "either",
//     title: "Product Strategy Definition",
//     question:
//       "Based on your market research and competitive analysis, define the product strategy for the Nexus Bank startup account. What are the two or three core features you would prioritise for the first release, and why? How would you handle the tension between what startups want and what compliance teams will accept?",
//     guidance: [
//       "Prioritise based on validated needs not assumptions",
//       "Acknowledge real constraints rather than ignoring them",
//       "Show your prioritisation logic clearly",
//       "Think about what success looks like at six months post-launch",
//     ],
//     minWords: 200,
//   },
//   {
//     id: 4,
//     type: "typed",
//     title: "Stakeholder Communication",
//     question:
//       "You need to present your initial product direction to the CEO at the end of week two. How would you structure this communication? What would you include, what would you leave out, and how would you handle questions about areas of uncertainty?",
//     guidance: [
//       "Think about what the CEO needs to make a decision",
//       "Be honest about assumptions and uncertainties",
//       "Structure matters as much as content",
//       "Anticipate the hardest questions you might face",
//     ],
//     minWords: 200,
//   },
//   {
//     id: 5,
//     type: "url",
//     title: "Strategic Summary",
//     question:
//       "Using any tool of your choice, produce a one page strategic summary outlining your recommended approach, key assumptions, and the biggest risks you see at this stage. Share the link to your completed document below and explain your strategic choices in the rationale field.",
//     guidance: [
//       "Keep it to one page maximum",
//       "Be explicit about what you know versus what you are assuming",
//       "Prioritise clarity over comprehensiveness",
//       "Think about what a CEO needs to see to feel confident moving forward",
//     ],
//     minWords: 100,
//   },
// ];

// /** Minutes remaining at the start of each step (index 0–4). */
// export const TIME_REMAINING = [45, 36, 27, 17, 8];

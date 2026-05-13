import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(url, key);

const SLUG = "tosin-sonde";

const updates = {
  headline: "Founder · Career Bridge Foundation · 20 years in product and project management",
  bio: "I founded Career Bridge Foundation to help career changers and early-career professionals demonstrate real workplace skills with verifiable evidence. Our platform offers AI-evaluated simulations across product management, project management, cyber security, and more. Building what I wish existed when I was starting out.",
  location: "Harwich, UK",
  linkedin_url: "https://www.linkedin.com/in/victorsonde",
  external_links: [
    { label: "YouTube", url: "https://www.youtube.com/@growwithvictorsonde" },
    { label: "Cybersim", url: "https://www.cybersim.digital" },
    { label: "GitHub", url: "https://github.com/Career-Bridge-Foundation" },
  ],
};

async function seed() {
  const { data: existing, error: selectError } = await supabase
    .from("portfolio_profiles")
    .select("id, slug")
    .eq("slug", SLUG)
    .maybeSingle();

  if (selectError) {
    console.error("Error checking for existing row:", selectError.message);
    process.exit(1);
  }

  if (!existing) {
    console.error(`❌ No portfolio_profile found with slug '${SLUG}'`);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from("portfolio_profiles")
    .update(updates)
    .eq("slug", SLUG)
    .select()
    .single();

  if (error) {
    console.error("Error updating portfolio_profile:", error.message);
    process.exit(1);
  }

  console.log(`✅ Seeded portfolio_profiles row for ${SLUG}`);
  console.log("Fields updated:");
  console.log(`  headline:       ${data.headline}`);
  console.log(`  bio:            ${data.bio.slice(0, 80)}${data.bio.length > 80 ? "…" : ""}`);
  console.log(`  location:       ${data.location}`);
  console.log(`  linkedin_url:   ${data.linkedin_url}`);
  console.log(`  external_links: ${data.external_links.length} link(s)`);
  for (const link of data.external_links) {
    console.log(`    - ${link.label}: ${link.url}`);
  }
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

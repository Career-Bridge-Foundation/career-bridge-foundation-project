import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { simulations as sims } from "../lib/simulations-data";

loadEnvConfig(process.cwd());

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function seed() {
  // Seed all admin emails from ADMIN_EMAILS env var (comma-separated)
  const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.SEED_ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  for (const email of adminEmails) {
    const { error } = await supabase.from("admins").upsert({ email }, { onConflict: "email" });
    if (error) console.error(`Error upserting admin ${email}:`, error.message);
    else console.log(`Upserted admin: ${email}`);
  }

  for (const s of sims) {
    // For product-strategy keep description; for others, leave content fields null and prompts []
    const isProduct = s.slug === "product-strategy";
    const row = {
      slug: s.slug,
      title: s.title ?? null,
      company: s.company ?? null,
      industry: s.industry ?? null,
      type: s.type ?? null,
      difficulty: s.difficulty ?? null,
      time: s.time ?? null,
      description: isProduct ? s.description ?? null : null,
      display_order: null,
      sim_role: null,
      brief_short: null,
      brief_full: null,
      video_transcript: null,
      time_remaining: null,
      prompts: []
    };

    const { error } = await supabase.from("simulations").upsert(row, { onConflict: "slug" });
    if (error) console.error("Error upserting", s.slug, error.message);
    else console.log("Upserted", s.slug);
  }
}

seed().then(() => {
  console.log("Seeding complete");
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

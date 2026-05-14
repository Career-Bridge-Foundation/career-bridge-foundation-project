import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Simulation, SimulationPrompt, SimulationRubric, SimulationVideoUrls } from "@/types/simulation";

type SimulationRecord = Record<string, unknown>;
type RawPrompt = Record<string, unknown>;
type RawRubricPrompt = Record<string, unknown>;

function pickString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    if (value.trim() === "") continue;
    return value;
  }
  return "";
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeVideoUrls(raw: unknown): SimulationVideoUrls | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  return {
    scenarioIntro: (v.scenarioIntro ?? v.scenario_intro) as string | undefined,
    resultsDistinction: (v.resultsDistinction ?? v.results_distinction) as string | undefined,
    resultsMerit: (v.resultsMerit ?? v.results_merit) as string | undefined,
    resultsPass: (v.resultsPass ?? v.results_pass) as string | undefined,
    resultsDevelopment: (v.resultsDevelopment ?? v.results_development) as string | undefined,
  };
}

function parseWordCount(guidance: unknown): number {
  if (typeof guidance === "number") return guidance;
  if (typeof guidance === "string") {
    const nums = guidance.match(/\d+/g);
    if (nums) return Number(nums[nums.length - 1]);
  }
  return 0;
}

function normalizePrompt(p: RawPrompt): SimulationPrompt {
  const body = pickString(p.body, p.text, p.question);

  const rawSubmissionType = pickString(p.submissionType, p.submission_type, p.type);
  let submissionType: SimulationPrompt["submissionType"] = "typed";
  if (rawSubmissionType === "typed" || rawSubmissionType === "either" || rawSubmissionType === "url") {
    submissionType = rawSubmissionType;
  }

  const wordMin = Number(p.wordMin ?? p.min_words ?? p.minWords ?? 0);
  const wordMax =
    parseWordCount(
      p.wordMax ?? p.word_guidance ?? p.typed_word_guidance ?? p.wordGuidance
    ) || wordMin;

  return {
    number: Number(p.number ?? p.promptNumber ?? p.prompt_number ?? 0),
    title: String(p.title ?? ""),
    body,
    submissionType,
    wordMin,
    wordMax,
    promptNumber: (p.promptNumber ?? p.prompt_number) as number | undefined,
    text: (p.text ?? p.question) as string | undefined,
    submission_type: p.submission_type as SimulationPrompt["submission_type"],
    min_words: (p.min_words ?? p.minWords) as number | undefined,
  };
}

function normalizeRubric(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    prompt1: (r.prompt1 ?? r.prompt_1) as RawRubricPrompt ?? { title: "", description: "", criteria: [] },
    prompt2: (r.prompt2 ?? r.prompt_2) as RawRubricPrompt ?? { title: "", description: "", criteria: [] },
    prompt3: (r.prompt3 ?? r.prompt_3) as RawRubricPrompt ?? { title: "", description: "", criteria: [] },
  };
}

function normalizeSimulation(row: SimulationRecord): Simulation {
  const rawDifficulty = String(row.difficulty ?? "Foundation");
  const difficulty = capitalizeFirst(rawDifficulty) as Simulation["difficulty"];

  const simulationType = pickString(
    row.simulationType,
    row.simulation_type,
    row["simulation-type"],
    row.type
  );

  const prompts = Array.isArray(row.prompts)
    ? (row.prompts as RawPrompt[]).map(normalizePrompt)
    : [];

  const rubric = normalizeRubric(row.rubric);
  const videoUrls = normalizeVideoUrls(row.videoUrls ?? row.video_urls);

  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    company: String(row.company ?? row.company_name ?? ""),
    companyName: (row.companyName ?? row.company_name) as string | undefined,
    discipline: String(row.discipline ?? ""),
    industry: String(row.industry ?? ""),
    candidateRole: String(row.candidateRole ?? row.candidate_role ?? ""),
    estimatedMinutes: String(row.estimatedMinutes ?? row.estimated_minutes ?? ""),
    difficulty,
    simulationType,
    type: simulationType,
    time: String(row.time ?? row.estimatedMinutes ?? row.estimated_minutes ?? ""),
    description: String(row.description ?? ""),
    scenarioBrief: String(row.scenarioBrief ?? row.scenario_brief ?? ""),
    scenarioBriefFull: (row.scenarioBriefFull ?? row.scenario_brief_full ?? null) as string | null,
    prompts,
    rubric: rubric as SimulationRubric | null,
    videoUrl: (row.videoUrl ?? null) as string | null,
    videoUrls,
    videoTranscript: (row.videoTranscript ?? row.video_transcript ?? null) as string | null,
    videoPresenterName: (row.videoPresenterName ?? row.video_presenter_name ?? null) as string | null,
    videoPresenterTitle: (row.videoPresenterTitle ?? row.video_presenter_title ?? null) as string | null,
    passingScore: Number(row.passingScore ?? row.passing_score ?? 55),
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
    company_name: (row.company_name) as string | undefined,
    candidate_role: (row.candidate_role) as string | undefined,
    estimated_minutes: (row.estimated_minutes) as string | undefined,
    simulation_type: (row.simulation_type ?? row["simulation-type"]) as string | undefined,
    scenario_brief: (row.scenario_brief) as string | undefined,
    scenario_brief_full: (row.scenario_brief_full) as string | undefined,
    video_urls: (row.video_urls) as SimulationVideoUrls | undefined,
    video_transcript: (row.video_transcript) as string | undefined,
    video_presenter_name: (row.video_presenter_name) as string | undefined,
    video_presenter_title: (row.video_presenter_title) as string | undefined,
    passing_score: (row.passing_score) as number | undefined,
    created_at: (row.created_at) as string | undefined,
  };
}

/**
 * @swagger
 * /api/simulations:
 *   get:
 *     summary: Get simulations
 *     description: Returns a list of all available simulations, newest first. If the optional id or slug query parameter is provided, returns a single simulation.
 *     tags:
 *       - Simulations
 *     parameters:
 *       - in: query
 *         name: id
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional simulation id. When provided, the endpoint returns one simulation instead of the full list.
 *       - in: query
 *         name: slug
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional simulation slug. Used for human-readable routes like /simulate/product-strategy.
 *     responses:
 *       200:
 *         description: Simulation list or single simulation
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SimulationListResponse'
 *                 - $ref: '#/components/schemas/SimulationResponse'
 *       404:
 *         description: Simulation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const slug = searchParams.get("slug");
    const identifier = (id || slug || "").trim();

    if (identifier) {
      const { data, error } = await supabaseAdmin
        .from("simulations")
        .select("*")
        .or(`id.eq.${identifier},slug.eq.${identifier}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch simulation by id/slug: ${error.message}`);
      }

      if (!data) {
        return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
      }

      const simulation = normalizeSimulation(data as SimulationRecord);
      return NextResponse.json({ simulation });
    }

    const { data, error } = await supabaseAdmin
      .from("simulations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch simulations: ${error.message}`);
    }

    const simulations = (data ?? []).map((row) => normalizeSimulation(row as SimulationRecord));
    return NextResponse.json({ simulations });
  } catch (error) {
    console.error("Error fetching simulations:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
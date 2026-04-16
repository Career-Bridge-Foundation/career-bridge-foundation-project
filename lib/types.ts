// Matches the simulations table in Supabase
export type Simulation = {
  id: string;
  title: string;
  company_name: string;
  discipline: string;
  industry: string | null;
  candidate_role: string | null;
  estimated_minutes: string | null;
  video_urls: VideoUrls | null;
  passing_score: number;
  scenario_brief: string;
  prompts: Prompt[];
  rubric: Rubric;
  created_at: string;
};

export type Prompt = {
  prompt_number: number;
  title: string;
  text: string;
  submission_type: "typed" | "either";
  word_guidance?: string;
  typed_word_guidance?: string;
  upload_formats?: string[];
  upload_max_size_mb?: number;
  upload_instruction?: string;
  url_allowed?: boolean;
  url_rationale_min_words?: number;
  url_instruction?: string;
  min_words: number;
};

export type RubricCriterion = {
  name: string;
  weak: string;
  competent: string;
  strong: string;
};

export type RubricPrompt = {
  title: string;
  description: string;
  criteria: RubricCriterion[];
};

export type Rubric = {
  prompt_1: RubricPrompt;
  prompt_2: RubricPrompt;
  prompt_3: RubricPrompt;
};

export type VideoUrls = {
  scenario_intro?: string;
  results_distinction?: string;
  results_merit?: string;
  results_pass?: string;
  results_development?: string;
};

export type SimulationCardProps = Pick<
  Simulation,
  | "id"
  | "title"
  | "discipline"
  | "company_name"
  | "industry"
  | "candidate_role"
  | "estimated_minutes"
>;

export type SimulationHeroProps = {
  simulation: Simulation;
};

export type ScenarioBriefProps = {
  brief: string;
};

export type CandidateGateProps = {
  simulationId: string;
};

export type VideoPlayerProps = {
  src: string | null;
  className?: string;
};

export type SimulatePageProps = {
  params: Promise<{ id: string }>;
};
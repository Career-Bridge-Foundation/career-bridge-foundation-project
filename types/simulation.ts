export type SubmissionType = 'typed' | 'either' | 'url'

export type SimulationDifficulty = 'Foundation' | 'Practitioner' | 'Advanced'

export type SimulationVideoUrls = {
  scenarioIntro?: string
  resultsDistinction?: string
  resultsMerit?: string
  resultsPass?: string
  resultsDevelopment?: string
}

export type SimulationRubricCriterion = {
  name: string
  weak: string
  competent: string
  strong: string
}

export type SimulationRubricPrompt = {
  title: string
  description: string
  criteria: SimulationRubricCriterion[]
}

export type SimulationRubric = {
  prompt1: SimulationRubricPrompt
  prompt2: SimulationRubricPrompt
  prompt3: SimulationRubricPrompt
}

export type SimulationPrompt = {
  number: number
  title: string
  body: string
  submissionType: SubmissionType
  wordMin: number
  wordMax: number
  promptNumber?: number
  text?: string
  submission_type?: SubmissionType
  min_words?: number
}

export type Simulation = {
  id: string
  slug: string
  title: string
  company: string
  companyName?: string
  discipline: string
  industry: string
  candidateRole: string
  estimatedMinutes: string
  difficulty: SimulationDifficulty
  simulationType: string
  type: string
  time: string
  description: string
  scenarioBrief: string
  scenarioBriefFull: string | null
  prompts: SimulationPrompt[]
  rubric: SimulationRubric | null
  videoUrl: string | null
  videoUrls: SimulationVideoUrls | null
  videoTranscript: string | null
  videoPresenterName: string | null
  videoPresenterTitle: string | null
  passingScore: number
  createdAt: string

  company_name?: string
  candidate_role?: string
  estimated_minutes?: string
  simulation_type?: string
  scenario_brief?: string
  scenario_brief_full?: string
  video_urls?: SimulationVideoUrls
  video_transcript?: string
  video_presenter_name?: string
  video_presenter_title?: string
  passing_score?: number
  created_at?: string
}

export type Discipline = {
  id: string
  name: string
  slug: string
  description: string
  status: string //"available" | "coming-soon"
  count: string | null
}
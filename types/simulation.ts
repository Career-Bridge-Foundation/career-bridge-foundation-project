export type SubmissionType = 'typed' | 'either' | 'url'

export type SimulationPrompt = {
  number: number
  title: string
  body: string
  submissionType: SubmissionType
  wordMin: number
  wordMax: number
}

export type Simulation = {
  id: string
  title: string
  company: string
  discipline: string
  industry: string
  candidateRole: string
  estimatedMinutes: string
  scenarioBrief: string
  prompts: SimulationPrompt[]
  videoUrl: string | null
  passingScore: number
}

import { z } from 'zod'

// ── Metadata ──────────────────────────────────────────────────────────────────

export const SimulationMetadataSchema = z.object({
  title: z.string().min(1, 'Required').max(120),
  company: z.string().min(1, 'Required').max(80),
  industry: z.string().min(1, 'Required').max(60),
  type: z.string().max(60).optional(),
  difficulty: z.enum(['Foundation', 'Practitioner', 'Advanced'], {
    errorMap: () => ({ message: 'Select a difficulty' }),
  }),
  time: z.string().min(1, 'Required').max(40),
  description: z.string().max(280).optional(),
  discipline: z.string().max(80).optional(),
  video_url: z.string().url('Enter a valid URL').or(z.literal('')).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  slug: z
    .string()
    .min(2, 'At least 2 characters')
    .max(60, 'At most 60 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase, numbers, hyphens only'),
})

export type SimulationMetadata = z.infer<typeof SimulationMetadataSchema>

export const ReorderSchema = z.array(
  z.object({
    slug: z.string().min(1),
    display_order: z.number().int().min(0),
  })
)

export type ReorderItem = z.infer<typeof ReorderSchema>[number]

// ── Content ───────────────────────────────────────────────────────────────────

export const GuidanceBulletSchema = z
  .string()
  .min(1, 'Guidance cannot be empty')
  .max(200, 'Guidance must be 200 characters or less')

export const PromptSchema = z.object({
  id: z.union([z.string().uuid(), z.string()]),
  type: z.enum(['typed', 'url', 'either']),
  title: z.string().min(1, 'Title is required').max(200),
  question: z.string().min(1, 'Question is required').max(2000),
  guidance: z.array(GuidanceBulletSchema).min(0).max(20),
  minWords: z.number().int().min(0).max(5000),
})

export type Prompt = z.infer<typeof PromptSchema>

export const SimulationContentSchema = z
  .object({
    id: z.string().uuid(),
    sim_role: z.string().nullable().default(null),
    brief_short: z.string().nullable().default(null),
    brief_full: z.string().nullable().default(null),
    video_transcript: z.string().nullable().default(null),
    time_remaining: z.array(z.number().int().min(0)).default([]),
    prompts: z.array(PromptSchema).min(1, 'At least one prompt is required').max(10),
  })
  .refine(
    data => data.time_remaining.length === data.prompts.length,
    'Number of time_remaining entries must match number of prompts'
  )

export type SimulationContent = z.infer<typeof SimulationContentSchema>

// ── Import/Export ─────────────────────────────────────────────────────────────

export const SimulationExportRowSchema = SimulationMetadataSchema.extend({
  id: z.string().uuid(),
  published_at: z.string().nullable().optional(),
  sim_role: z.string().nullable().optional(),
  brief_short: z.string().nullable().optional(),
  brief_full: z.string().nullable().optional(),
  video_transcript: z.string().nullable().optional(),
  time_remaining: z.array(z.number().int().min(0)).optional(),
  prompts: z.array(PromptSchema).optional(),
  display_order: z.number().int().min(0).optional(),
})

export const SimulationImportSchema = z.object({
  simulations: z.array(SimulationExportRowSchema).min(1),
})

export type SimulationExportRow = z.infer<typeof SimulationExportRowSchema>
export type SimulationImport = z.infer<typeof SimulationImportSchema>

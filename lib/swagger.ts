import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Career Bridge API",
        version: "1.0.0",
        description: "API for the Career Bridge Portfolio Simulations platform",
      },
      servers: [{ url: "http://localhost:3000", description: "Development" }],
      components: {
        schemas: {
          Error: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          StartAttemptRequest: {
            type: "object",
            required: ["simulation_id", "candidate_name", "candidate_email"],
            properties: {
              simulation_id: { type: "string" },
              candidate_name: { type: "string" },
              candidate_email: { type: "string", format: "email" },
            },
          },
          StartAttemptResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              attempt_id: { type: "string" },
            },
          },
          SimulationPrompt: {
            type: "object",
            properties: {
              number: { type: "integer" },
              prompt_number: { type: "integer" },
              promptNumber: { type: "integer" },
              title: { type: "string" },
              body: { type: "string" },
              text: { type: "string" },
              submissionType: {
                type: "string",
                enum: ["typed", "either", "url"],
              },
              submission_type: {
                type: "string",
                enum: ["typed", "either", "url"],
              },
              wordMin: { type: "integer" },
              wordMax: { type: "integer" },
              word_guidance: { type: "string" },
              typed_word_guidance: { type: "string" },
              upload_formats: {
                type: "array",
                items: { type: "string" },
              },
              upload_max_size_mb: { type: "number" },
              upload_instruction: { type: "string" },
              url_allowed: { type: "boolean" },
              url_rationale_min_words: { type: "number" },
              url_instruction: { type: "string" },
              min_words: { type: "integer" },
            },
          },
          RubricCriterion: {
            type: "object",
            properties: {
              name: { type: "string" },
              weak: { type: "string" },
              competent: { type: "string" },
              strong: { type: "string" },
            },
          },
          RubricPrompt: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              criteria: {
                type: "array",
                items: { $ref: "#/components/schemas/RubricCriterion" },
              },
            },
          },
          VideoUrls: {
            type: "object",
            properties: {
              scenarioIntro: { type: "string" },
              scenario_intro: { type: "string" },
              resultsDistinction: { type: "string" },
              results_distinction: { type: "string" },
              resultsMerit: { type: "string" },
              results_merit: { type: "string" },
              resultsPass: { type: "string" },
              results_pass: { type: "string" },
              resultsDevelopment: { type: "string" },
              results_development: { type: "string" },
            },
          },
          Simulation: {
            type: "object",
            properties: {
              id: { type: "string" },
              slug: { type: "string", nullable: true },
              title: { type: "string" },
              discipline: { type: "string" },
              company: { type: "string" },
              company_name: { type: "string" },
              companyName: { type: "string", nullable: true },
              industry: { type: "string" },
              candidateRole: { type: "string" },
              candidate_role: { type: "string", nullable: true },
              estimatedMinutes: { type: "string" },
              estimated_minutes: { type: "string", nullable: true },
              difficulty: { type: "string", enum: ["Foundation", "Practitioner", "Advanced"] },
              simulationType: { type: "string" },
              simulation_type: { type: "string", nullable: true },
              type: { type: "string" },
              time: { type: "string" },
              description: { type: "string" },
              scenarioBrief: { type: "string" },
              scenario_brief: { type: "string" },
              scenarioBriefFull: { type: "string", nullable: true },
              scenario_brief_full: { type: "string", nullable: true },
              prompts: {
                type: "array",
                items: { $ref: "#/components/schemas/SimulationPrompt" },
              },
              rubric: {
                oneOf: [
                  { $ref: "#/components/schemas/Rubric" },
                  { type: "null" },
                ],
              },
              videoUrl: { type: "string", nullable: true },
              videoUrls: {
                oneOf: [
                  { $ref: "#/components/schemas/VideoUrls" },
                  { type: "null" },
                ],
              },
              video_urls: {
                oneOf: [
                  { $ref: "#/components/schemas/VideoUrls" },
                  { type: "null" },
                ],
              },
              videoTranscript: { type: "string", nullable: true },
              video_transcript: { type: "string", nullable: true },
              videoPresenterName: { type: "string", nullable: true },
              video_presenter_name: { type: "string", nullable: true },
              videoPresenterTitle: { type: "string", nullable: true },
              video_presenter_title: { type: "string", nullable: true },
              passingScore: { type: "integer" },
              passing_score: { type: "integer" },
              createdAt: { type: "string", format: "date-time" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          Rubric: {
            type: "object",
            properties: {
              prompt1: { $ref: "#/components/schemas/RubricPrompt" },
              prompt2: { $ref: "#/components/schemas/RubricPrompt" },
              prompt3: { $ref: "#/components/schemas/RubricPrompt" },
              prompt_1: { $ref: "#/components/schemas/RubricPrompt" },
              prompt_2: { $ref: "#/components/schemas/RubricPrompt" },
              prompt_3: { $ref: "#/components/schemas/RubricPrompt" },
            },
          },
          SimulationListResponse: {
            type: "object",
            properties: {
              simulations: {
                type: "array",
                items: { $ref: "#/components/schemas/Simulation" },
              },
            },
          },
          SimulationResponse: {
            type: "object",
            properties: {
              simulation: { $ref: "#/components/schemas/Simulation" },
            },
          },
          TypedSubmissionRequest: {
            type: "object",
            required: ["attempt_id", "prompt_number", "submission_type", "text"],
            properties: {
              attempt_id: { type: "string" },
              prompt_number: { type: "integer" },
              submission_type: { type: "string", enum: ["typed"] },
              text: {
                type: "string",
                description: "Candidate typed response. Must contain at least 50 words.",
              },
            },
          },
          UrlSubmissionRequest: {
            type: "object",
            required: ["attempt_id", "prompt_number", "submission_type", "url", "rationale"],
            properties: {
              attempt_id: { type: "string" },
              prompt_number: { type: "integer" },
              submission_type: { type: "string", enum: ["url"] },
              url: { type: "string", format: "uri" },
              rationale: {
                type: "string",
                description: "Candidate rationale. Must contain at least 50 words.",
              },
            },
          },
          FileSubmissionRequest: {
            type: "object",
            required: ["attempt_id", "prompt_number", "file"],
            properties: {
              attempt_id: { type: "string" },
              prompt_number: { type: "integer" },
              submission_type: {
                type: "string",
                enum: ["file"],
                nullable: true,
                description: "Optional. Multipart uploads are treated as file submissions.",
              },
              file: { type: "string", format: "binary" },
            },
          },
          SubmissionSuccessResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              prompt_number: { type: "integer" },
              submission_type: { type: "string" },
            },
          },
          EvaluateRequest: {
            type: "object",
            required: ["attempt_id"],
            properties: {
              attempt_id: { type: "string" },
              run_inline: {
                type: "boolean",
                description:
                  "Internal worker flag. When true, evaluates immediately; otherwise queues and returns 202.",
              },
            },
          },
          PromptCriterion: {
            type: "object",
            properties: {
              criterion_name: { type: "string" },
              score: { type: "integer", minimum: 1, maximum: 3 },
              score_label: { type: "string", enum: ["Weak", "Competent", "Strong"] },
              feedback: { type: "string" },
            },
          },
          PromptEvaluationResult: {
            type: "object",
            properties: {
              prompt_number: { type: "integer" },
              criteria: {
                type: "array",
                items: { $ref: "#/components/schemas/PromptCriterion" },
              },
              prompt_score: { type: "number" },
              prompt_max: { type: "number" },
              prompt_percentage: { type: "number" },
              prompt_verdict: { type: "string" },
            },
          },
          OverallSimulationResult: {
            type: "object",
            properties: {
              candidate_name: { type: "string" },
              candidate_email: { type: "string" },
              simulation_title: { type: "string" },
              discipline: { type: "string" },
              completed_date: { type: "string", format: "date-time" },
              prompt_results: {
                type: "array",
                items: { $ref: "#/components/schemas/PromptEvaluationResult" },
              },
              overall_score: { type: "number" },
              overall_max: { type: "number" },
              overall_percentage: { type: "number" },
              verdict: { type: "string" },
              verdict_description: { type: "string" },
              overall_summary: { type: "string" },
              top_strength: { type: "string" },
              top_development_area: { type: "string" },
              shareable_url_token: { type: "string" },
              results_video_file: { type: "string" },
              certifier_trigger: { type: "boolean" },
              certifier_credential_id: { type: "string" },
            },
          },
          EvaluateSuccessResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              attempt_id: { type: "string" },
              result: { $ref: "#/components/schemas/OverallSimulationResult" },
            },
          },
          AttemptState: {
            type: "object",
            properties: {
              id: { type: "string" },
              simulation_id: { type: "string" },
              candidate_name: { type: "string" },
              candidate_email: { type: "string", format: "email" },
              responses: {
                type: "object",
                additionalProperties: true,
              },
              status: { type: "string" },
              evaluation_status: { type: "string", nullable: true },
              current_step: { type: "integer", nullable: true },
              last_saved_at: { type: "string", format: "date-time", nullable: true },
            },
          },
          AttemptStateResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              attempt: { $ref: "#/components/schemas/AttemptState" },
            },
          },
          AttemptAutosaveRequest: {
            type: "object",
            properties: {
              current_step: { type: "integer", minimum: 1 },
              last_saved_at: { type: "string", format: "date-time" },
              drafts: {
                type: "object",
                additionalProperties: { type: "string" },
                description:
                  "Draft text keyed by prompt key (e.g. prompt_1 or 1). Values are saved as draft_text in responses.",
              },
              responses: {
                type: "object",
                additionalProperties: true,
                description: "Optional direct responses patch merged into responses JSON.",
              },
            },
          },
          ChatRequest: {
            type: "object",
            required: ["message", "attempt_id", "prompt_index"],
            properties: {
              message: { type: "string" },
              taskTitle: { type: "string" },
              taskDescription: { type: "string" },
              taskGuidance: { type: "string" },
              attempt_id: { type: "string" },
              prompt_index: { type: "integer" },
            },
          },
          ChatMessage: {
            type: "object",
            properties: {
              id: { type: "string" },
              attempt_id: { type: "string" },
              prompt_index: { type: "integer" },
              role: { type: "string", enum: ["user", "assistant", "system"] },
              content: { type: "string" },
              task_title: { type: "string", nullable: true },
              task_description: { type: "string", nullable: true },
              task_guidance: { type: "string", nullable: true },
              created_at: { type: "string", format: "date-time" },
            },
          },
          ChatSseEvent: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["start", "delta", "done", "error"],
              },
              text: { type: "string" },
              message: { type: "string" },
            },
          },
          AttemptChatHistoryResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              attempt_id: { type: "string" },
              messages: {
                type: "array",
                items: { $ref: "#/components/schemas/ChatMessage" },
              },
            },
          },
          AttemptAttachment: {
            type: "object",
            properties: {
              id: { type: "string" },
              attempt_id: { type: "string" },
              prompt_index: { type: "integer" },
              attachment_type: { type: "string", enum: ["file", "url"] },
              file_name: { type: "string", nullable: true },
              file_mime_type: { type: "string", nullable: true },
              file_size_bytes: { type: "number", nullable: true },
              storage_path: { type: "string", nullable: true },
              external_url: { type: "string", nullable: true },
              virus_scan_status: { type: "string", nullable: true },
              virus_scan_details: {
                type: "object",
                additionalProperties: true,
                nullable: true,
              },
              created_at: { type: "string", format: "date-time" },
            },
          },
          AttemptAttachmentResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              attachment: { $ref: "#/components/schemas/AttemptAttachment" },
              signed_url: { type: "string", nullable: true },
            },
          },
          AttemptSubmitResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              attempt_id: { type: "string" },
              evaluation_status: { type: "string" },
              message: { type: "string" },
            },
          },
          AttemptSubmitValidationError: {
            type: "object",
            properties: {
              error: { type: "string" },
              missing_prompt_indexes: {
                type: "array",
                items: { type: "integer" },
              },
            },
          },
          EvaluateQueueResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              attempt_id: { type: "string" },
              evaluation_status: { type: "string" },
              message: { type: "string" },
            },
          },
          EvaluateProcessResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              attempt_id: { type: "string" },
              message: { type: "string" },
            },
          },
          ManualReviewResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          Discipline: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              slug: { type: "string" },
              description: { type: "string", nullable: true },
              status: { type: "string" },
              count: { type: "string", nullable: true },
            },
          },
          DisciplineListResponse: {
            type: "object",
            properties: {
              disciplines: {
                type: "array",
                items: { $ref: "#/components/schemas/Discipline" },
              },
            },
          },
          Credential: {
            type: "object",
            properties: {
              verification_code: { type: "string" },
              candidate_name: { type: "string" },
              discipline: { type: "string" },
              credential_title: { type: "string" },
              issued_at: { type: "string", format: "date-time" },
              expires_at: { type: "string", format: "date-time", nullable: true },
              status: { type: "string" },
              certifier_credential_id: { type: "string", nullable: true },
              metadata: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
          CredentialVerificationResponse: {
            type: "object",
            properties: {
              verified: { type: "boolean" },
              credential: { $ref: "#/components/schemas/Credential" },
            },
          },
        },
      },
    },
  });

  return spec;
};
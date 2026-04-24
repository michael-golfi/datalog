import OpenAI from 'openai';
import { z } from 'zod';

import type {
  GraphRagLlmClient,
  GraphRagLlmInput,
  GraphRagLlmOutput,
} from './ontology-graph-rag-agent-fixture.js';
import {
  sortEvidenceRecords,
  type GraphRagEvidence,
} from './ontology-graph-rag-evidence-fixture.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const findingTypeEnumValues = [
  'indication',
  'risk',
  'alternative',
  'class',
  'mapping',
  'comorbidity',
] as const;

const scenarioIdEnumValues = [
  'pregnancy-lisinopril-hypertension',
  'ckd-heart-failure-ibuprofen',
  'atrial-fibrillation-anticoagulant-alternatives',
] as const;

/**
 * JSON Schema for OpenAI structured outputs (strict mode).
 * This schema enforces findingType as an enum at the provider level.
 * Post-parse Zod validation adds discriminated-union semantics and min-length constraints.
 */
const openAiJsonSchema = {
  type: 'object' as const,
  properties: {
    scenarioId: { type: 'string' as const, enum: scenarioIdEnumValues },
    status: { type: 'string' as const, enum: ['answered', 'insufficient_evidence'] },
    answer: { type: 'string' as const },
    keyFindings: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          findingType: { type: 'string' as const, enum: findingTypeEnumValues },
          subjectId: { type: 'string' as const },
          objectId: { type: 'string' as const },
          citationIds: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: ['findingType', 'subjectId', 'objectId', 'citationIds'],
        additionalProperties: false,
      },
    },
    citations: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          evidenceId: { type: 'string' as const },
          supports: { type: 'string' as const },
        },
        required: ['evidenceId', 'supports'],
        additionalProperties: false,
      },
    },
  },
  required: ['scenarioId', 'status', 'answer', 'keyFindings', 'citations'],
  additionalProperties: false,
};

const scenarioIdEnum = z.enum(scenarioIdEnumValues);

const findingTypeSchema = z.enum(findingTypeEnumValues);

const keyFindingSchema = z.object({
  findingType: findingTypeSchema,
  subjectId: z.string(),
  objectId: z.string(),
  citationIds: z.array(z.string()).min(1),
});

const citationSchema = z.object({
  evidenceId: z.string(),
  supports: z.string().min(1),
});

const AnsweredSchema = z.object({
  scenarioId: scenarioIdEnum,
  status: z.literal('answered'),
  answer: z.string().min(1),
  keyFindings: z.array(keyFindingSchema).min(1),
  citations: z.array(citationSchema).min(1),
});

const InsufficientEvidenceSchema = z.object({
  scenarioId: scenarioIdEnum,
  status: z.literal('insufficient_evidence'),
  answer: z.string().min(1),
  keyFindings: z.array(keyFindingSchema),
  citations: z.array(citationSchema),
});

export const GraphRagAnswerSchema = z.discriminatedUnion('status', [
  AnsweredSchema,
  InsufficientEvidenceSchema,
]);

export { scenarioIdEnum, findingTypeSchema };

export function isOpenAiGraphRagUnavailable(): boolean {
  return process.env['OPENAI_API_KEY'] === undefined || process.env['OPENAI_API_KEY'] === '';
}

export function createOpenAiGraphRagLlmClient(): GraphRagLlmClient {
  const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
  });
  const model = process.env['MEDICAL_ONTOLOGY_GRAPH_RAG_OPENAI_MODEL'] ?? DEFAULT_OPENAI_MODEL;

  return {
    async answer(input: GraphRagLlmInput): Promise<GraphRagLlmOutput> {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'graph_rag_answer',
            strict: true,
            schema: openAiJsonSchema,
          },
        },
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(),
          },
          {
            role: 'user',
            content: buildUserPrompt(input),
          },
        ],
      });

      const content = completion.choices[0]?.message.content;
      if (content === undefined || content === null || content === '') {
        throw new Error('OpenAI Graph RAG response did not include JSON content');
      }

      const parsedContent: unknown = JSON.parse(content);
      return GraphRagAnswerSchema.parse(parsedContent);
    },
  };
}

function buildSystemPrompt(): string {
  return [
    'You answer clinical ontology Graph RAG scenarios using ONLY the provided ontology evidence.',
    'Cite every clinical claim with evidence IDs from the provided evidence context.',
    'You MUST cite EVERY required evidence ID listed in the user prompt at least once in your citations array.',
    'You MUST include every required entity ID from the user prompt as either a subjectId or objectId in at least one keyFinding.',
    'Never invent, hallucinate, or alter evidence IDs.',
    'If the provided evidence is insufficient, return status "insufficient_evidence".',
    'Return ONLY valid JSON (no markdown) matching this exact schema:',
    '{',
    '  "scenarioId": "<scenario-id>",',
    '  "status": "answered" | "insufficient_evidence",',
    '  "answer": "<clinical summary>",',
    '  "keyFindings": [{ "findingType": "indication"|"risk"|"alternative"|"class"|"mapping"|"comorbidity", "subjectId": "<entity-id>", "objectId": "<entity-id>", "citationIds": ["<evidence-id>"] }],',
    '  "citations": [{ "evidenceId": "<evidence-id>", "supports": "<what it supports>" }]',
    '}',
  ].join('\n');
}

function buildUserPrompt(input: GraphRagLlmInput): string {
  return [
    `Scenario ID: ${input.scenario.scenarioId}`,
    `Question: ${input.scenario.question}`,
    '',
    'Required evidence IDs:',
    input.scenario.requiredEvidenceIds.map((id) => `- ${id}`).join('\n'),
    '',
    'Required entity IDs:',
    input.scenario.requiredEntityIds.map((id) => `- ${id}`).join('\n'),
    '',
    'Ontology evidence:',
    buildEvidenceContext(input.evidence),
  ].join('\n');
}

function buildEvidenceContext(evidenceRecords: readonly GraphRagEvidence[]): string {
  return sortEvidenceRecords(evidenceRecords)
    .map((evidence) => `[${evidence.evidenceId}] ${evidence.evidenceType}: ${evidence.subjectLabel ?? evidence.subjectId} → ${evidence.objectLabel ?? evidence.objectId}`)
    .join('\n');
}

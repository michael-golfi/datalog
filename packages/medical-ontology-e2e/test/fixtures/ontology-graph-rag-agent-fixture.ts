import {
  validateRequiredEvidence,
  type EvidenceValidationResult,
  type GraphRagEvidence,
} from './ontology-graph-rag-evidence-fixture.js';

import type { GraphRagScenario } from './ontology-graph-rag-scenarios-fixture.js';

export interface GraphRagLlmInput {
  readonly scenario: GraphRagScenario;
  readonly evidence: readonly GraphRagEvidence[];
}

type FindingType = 'indication' | 'risk' | 'alternative' | 'class' | 'mapping' | 'comorbidity';

export interface GraphRagKeyFinding {
  readonly findingType: FindingType;
  readonly subjectId: string;
  readonly objectId: string;
  readonly citationIds: readonly string[];
}

export interface GraphRagCitation {
  readonly evidenceId: string;
  readonly supports: string;
}

export interface GraphRagLlmOutput {
  readonly scenarioId: string;
  readonly status: 'answered' | 'insufficient_evidence';
  readonly answer: string;
  readonly keyFindings: readonly GraphRagKeyFinding[];
  readonly citations: readonly GraphRagCitation[];
}

export interface GraphRagLlmClient {
  answer(input: GraphRagLlmInput): Promise<GraphRagLlmOutput>;
}

export interface ResponseValidation {
  readonly isValid: boolean;
  readonly hallucinatedCitationIds: readonly string[];
  readonly hallucinatedFindingCitationIds: readonly string[];
  readonly uncitedRequiredEvidenceIds: readonly string[];
  readonly missingRequiredEntityIds: readonly string[];
}

export interface GraphRagAgentResult {
  readonly scenario: GraphRagScenario;
  readonly evidence: readonly GraphRagEvidence[];
  readonly validation: EvidenceValidationResult;
  readonly responseValidation: ResponseValidation | undefined;
  readonly llmOutput: GraphRagLlmOutput | undefined;
}

export interface GraphRagAgent {
  runScenario(
    scenario: GraphRagScenario,
    evidence: readonly GraphRagEvidence[],
  ): Promise<GraphRagAgentResult>;
}

export function createGraphRagAgent(options: {
  readonly llmClient: GraphRagLlmClient;
}): GraphRagAgent {
  const { llmClient } = options;

  return {
    async runScenario(
      scenario: GraphRagScenario,
      evidence: readonly GraphRagEvidence[],
    ): Promise<GraphRagAgentResult> {
      const validation = validateRequiredEvidence(evidence, scenario.requiredEvidenceIds);

      if (!validation.isComplete) {
        return {
          scenario,
          evidence,
          validation,
          responseValidation: undefined,
          llmOutput: {
            scenarioId: scenario.scenarioId,
            status: 'insufficient_evidence',
            answer: `Missing required evidence: ${validation.missingEvidenceIds.join(', ')}`,
            keyFindings: [],
            citations: [],
          },
        };
      }

      const llmOutput = await llmClient.answer({ scenario, evidence });
      const responseValidation = validateLlmResponse(llmOutput, evidence, scenario);

      return {
        scenario,
        evidence,
        validation,
        responseValidation,
        llmOutput,
      };
    },
  };
}

function validateLlmResponse(
  output: GraphRagLlmOutput,
  evidence: readonly GraphRagEvidence[],
  scenario: GraphRagScenario,
): ResponseValidation {
  if (output.scenarioId !== scenario.scenarioId || output.status !== 'answered') {
    return {
      isValid: false,
      hallucinatedCitationIds: [],
      hallucinatedFindingCitationIds: [],
      uncitedRequiredEvidenceIds: scenario.requiredEvidenceIds,
      missingRequiredEntityIds: scenario.requiredEntityIds,
    };
  }

  const evidenceIds = new Set(evidence.map((evidenceRecord) => evidenceRecord.evidenceId));
  const citedEvidenceIds = new Set(output.citations.map((citation) => citation.evidenceId));
  const findingCitationIds = output.keyFindings.flatMap((finding) => finding.citationIds);
  const findingEntityIds = new Set(
    output.keyFindings.flatMap((finding) => [finding.subjectId, finding.objectId]),
  );

  const hallucinatedCitationIds = output.citations
    .map((citation) => citation.evidenceId)
    .filter((evidenceId) => !evidenceIds.has(evidenceId));
  const hallucinatedFindingCitationIds = findingCitationIds
    .filter((evidenceId) => !evidenceIds.has(evidenceId));
  const uncitedRequiredEvidenceIds = scenario.requiredEvidenceIds
    .filter((evidenceId) => !citedEvidenceIds.has(evidenceId));
  const missingRequiredEntityIds = scenario.requiredEntityIds
    .filter((entityId) => !findingEntityIds.has(entityId));

  return {
    isValid: hallucinatedCitationIds.length === 0
      && hallucinatedFindingCitationIds.length === 0
      && uncitedRequiredEvidenceIds.length === 0
      && missingRequiredEntityIds.length === 0,
    hallucinatedCitationIds,
    hallucinatedFindingCitationIds,
    uncitedRequiredEvidenceIds,
    missingRequiredEntityIds,
  };
}

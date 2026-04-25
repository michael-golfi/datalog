import { describe, expect, it } from 'vitest';

import {
  createGraphRagAgent,
  type GraphRagLlmClient,
  type GraphRagLlmInput,
  type GraphRagLlmOutput,
} from './fixtures/ontology-graph-rag-agent-fixture.js';
import {
  createOntologyGraphRagLiveRetrievalFixture,
  type OntologyGraphRagLiveRetrievalFixture,
} from './fixtures/ontology-graph-rag-live-retrieval-fixture.js';
import {
  createOpenAiGraphRagLlmClient,
  isOpenAiGraphRagUnavailable,
} from './fixtures/ontology-graph-rag-llm-fixture.js';
import {
  allGraphRagScenarios,
  type GraphRagScenario,
} from './fixtures/ontology-graph-rag-scenarios-fixture.js';

const liveHappyPathScenarios = allGraphRagScenarios;
const liveOpenAiIt = isOpenAiGraphRagUnavailable() ? it.skip : it;

describe('ontology graph rag live e2e', () => {
  describe('default live happy paths', () => {
    it.each(liveHappyPathScenarios)(
      'answers the clinical question over live retrieval with a local deterministic LLM: $question',
      async (scenario) => {
        const recordedInputs: GraphRagLlmInput[] = [];

        await withLiveFixture(async ({ livePostgresFixture, retrieveScenarioEvidence }) => {
          const agent = createGraphRagAgent({
            llmClient: createRecordingDeterministicGraphRagLlmClient(recordedInputs),
          });
          const retrieval = await retrieveScenarioEvidence(scenario);
          const result = await agent.runScenario(scenario, retrieval.evidence);

          expect(livePostgresFixture.committedFileNames.length).toBeGreaterThan(0);
          expect(retrieval.question).toBe(scenario.question);
          expect(retrieval.scenarioId).toBe(scenario.scenarioId);
          expect(retrieval.evidence.length).toBeGreaterThan(0);
          expect(retrieval.appliedOverlayFacts).toEqual(scenario.liveTestSeedOverlay?.datalogFacts ?? []);
          expect(recordedInputs).toHaveLength(1);
          expect(recordedInputs[0]?.scenario.question).toBe(scenario.question);

          expect(result.validation.isComplete).toBe(true);
          expect(result.llmOutput?.status).toBe('answered');
          expect(result.llmOutput?.scenarioId).toBe(scenario.scenarioId);

          const answer = result.llmOutput?.answer.toLowerCase() ?? '';
          for (const requiredPhrase of scenario.answerQuality.requiredPhrases) {
            expect(answer).toContain(requiredPhrase.toLowerCase());
          }

          for (const forbiddenPhrase of scenario.answerQuality.forbiddenPhrases ?? []) {
            expect(answer).not.toContain(forbiddenPhrase.toLowerCase());
          }

          const retrievedEvidenceIds = new Set(retrieval.evidence.map((record) => record.evidenceId));
          expect(result.llmOutput?.citations.length).toBeGreaterThan(0);

          for (const requiredEvidenceId of scenario.requiredEvidenceIds) {
            expect(
              retrieval.retrievedEvidenceIds.has(requiredEvidenceId),
              `Scenario ${scenario.scenarioId} should retrieve required evidence ${requiredEvidenceId}`,
            ).toBe(true);

            expect(
              result.llmOutput?.citations.some((citation) => citation.evidenceId === requiredEvidenceId),
              `Scenario ${scenario.scenarioId} should cite required evidence ${requiredEvidenceId}`,
            ).toBe(true);
          }

          for (const citation of result.llmOutput?.citations ?? []) {
            expect(
              retrievedEvidenceIds.has(citation.evidenceId),
              `Scenario ${scenario.scenarioId} cited non-retrieved evidence ${citation.evidenceId}`,
            ).toBe(true);
            expect(citation.supports.length).toBeGreaterThan(0);
          }

          const findingEntityIds = new Set<string>();
          for (const finding of result.llmOutput?.keyFindings ?? []) {
            findingEntityIds.add(finding.subjectId);
            findingEntityIds.add(finding.objectId);
          }

          for (const requiredEntityId of scenario.requiredEntityIds) {
            expect(
              findingEntityIds.has(requiredEntityId),
              `Scenario ${scenario.scenarioId} should mention required entity ${requiredEntityId}`,
            ).toBe(true);
          }

          expect(result.responseValidation).toBeDefined();
          expect(result.responseValidation?.hallucinatedCitationIds).toEqual([]);
          expect(result.responseValidation?.hallucinatedFindingCitationIds).toEqual([]);
          expect(result.responseValidation?.uncitedRequiredEvidenceIds).toEqual([]);
          expect(result.responseValidation?.missingRequiredEntityIds).toEqual([]);
          expect(result.responseValidation?.isValid).toBe(true);
        });
      },
    );
  });

  describe('live OpenAI happy paths', () => {
    liveOpenAiIt.each(liveHappyPathScenarios)(
      'answers the clinical question over live retrieval with live OpenAI: $question',
      { timeout: 60_000 },
      async (scenario) => {
        await withLiveFixture(async ({ livePostgresFixture, retrieveScenarioEvidence }) => {
          const agent = createGraphRagAgent({
            llmClient: createOpenAiGraphRagLlmClient(),
          });
          const retrieval = await retrieveScenarioEvidence(scenario);
          const result = await agent.runScenario(scenario, retrieval.evidence);

          expect(livePostgresFixture.committedFileNames.length).toBeGreaterThan(0);
          expect(retrieval.question).toBe(scenario.question);
          expect(retrieval.scenarioId).toBe(scenario.scenarioId);
          expect(retrieval.evidence.length).toBeGreaterThan(0);
          expect(retrieval.appliedOverlayFacts).toEqual(scenario.liveTestSeedOverlay?.datalogFacts ?? []);

          expect(result.validation.isComplete).toBe(true);
          expect(result.llmOutput?.status).toBe('answered');
          expect(result.llmOutput?.scenarioId).toBe(scenario.scenarioId);

          const answer = result.llmOutput?.answer.toLowerCase() ?? '';
          for (const requiredPhrase of scenario.answerQuality.requiredPhrases) {
            expect(answer).toContain(requiredPhrase.toLowerCase());
          }

          for (const forbiddenPhrase of scenario.answerQuality.forbiddenPhrases ?? []) {
            expect(answer).not.toContain(forbiddenPhrase.toLowerCase());
          }

          const retrievedEvidenceIds = new Set(retrieval.evidence.map((record) => record.evidenceId));
          expect(result.llmOutput?.citations.length).toBeGreaterThan(0);

          for (const requiredEvidenceId of scenario.requiredEvidenceIds) {
            expect(
              retrieval.retrievedEvidenceIds.has(requiredEvidenceId),
              `Scenario ${scenario.scenarioId} should retrieve required evidence ${requiredEvidenceId}`,
            ).toBe(true);

            expect(
              result.llmOutput?.citations.some((citation) => citation.evidenceId === requiredEvidenceId),
              `Scenario ${scenario.scenarioId} should cite required evidence ${requiredEvidenceId}`,
            ).toBe(true);
          }

          const findingEntityIds = new Set<string>();
          for (const citation of result.llmOutput?.citations ?? []) {
            expect(
              retrievedEvidenceIds.has(citation.evidenceId),
              `Scenario ${scenario.scenarioId} cited non-retrieved evidence ${citation.evidenceId}`,
            ).toBe(true);
            expect(citation.supports.length).toBeGreaterThan(0);
          }

          for (const finding of result.llmOutput?.keyFindings ?? []) {
            findingEntityIds.add(finding.subjectId);
            findingEntityIds.add(finding.objectId);
          }

          for (const requiredEntityId of scenario.requiredEntityIds) {
            expect(
              findingEntityIds.has(requiredEntityId),
              `Scenario ${scenario.scenarioId} should mention required entity ${requiredEntityId}`,
            ).toBe(true);
          }

          expect(result.responseValidation).toBeDefined();
          expect(result.responseValidation?.hallucinatedCitationIds).toEqual([]);
          expect(result.responseValidation?.hallucinatedFindingCitationIds).toEqual([]);
          expect(result.responseValidation?.uncitedRequiredEvidenceIds).toEqual([]);
          expect(result.responseValidation?.missingRequiredEntityIds).toEqual([]);
          expect(result.responseValidation?.isValid).toBe(true);
        });
      },
    );
  });
});

function createRecordingDeterministicGraphRagLlmClient(
  recordedInputs: GraphRagLlmInput[],
): GraphRagLlmClient {
  return {
    async answer(input: GraphRagLlmInput): Promise<GraphRagLlmOutput> {
      recordedInputs.push(input);

      return {
        scenarioId: input.scenario.scenarioId,
        status: 'answered',
        answer: `${input.scenario.answerQuality.requiredPhrases.join('. ')}.`,
        citations: input.scenario.requiredEvidenceIds.map((evidenceId) => ({
          evidenceId,
          supports: `Grounds the answer to: ${input.scenario.question}`,
        })),
        keyFindings: input.scenario.requiredEntityIds.map((entityId, index) => ({
          findingType: 'mapping',
          subjectId: entityId,
          objectId: input.scenario.requiredEntityIds[(index + 1) % input.scenario.requiredEntityIds.length] ?? entityId,
          citationIds: [
            input.scenario.requiredEvidenceIds[index % input.scenario.requiredEvidenceIds.length]
            ?? input.evidence[0]?.evidenceId
            ?? '',
          ],
        })),
      };
    },
  };
}

async function withLiveFixture(
  run: (fixture: {
    readonly livePostgresFixture: OntologyGraphRagLiveRetrievalFixture;
    retrieveScenarioEvidence: ReturnType<typeof createScenarioEvidenceRetriever>;
  }) => Promise<void>,
): Promise<void> {
  const livePostgresFixture = await createOntologyGraphRagLiveRetrievalFixture();

  try {
    await run({
      livePostgresFixture,
      retrieveScenarioEvidence: createScenarioEvidenceRetriever(livePostgresFixture),
    });
  } finally {
    await livePostgresFixture.cleanup();
  }
}

function createScenarioEvidenceRetriever(livePostgresFixture: OntologyGraphRagLiveRetrievalFixture) {
  return async function retrieveScenarioEvidence(scenario: GraphRagScenario) {
    return livePostgresFixture.retrieveScenarioEvidence({
      scenario,
    });
  };
}

import { describe, expect, it } from 'vitest';

import {
  createGraphRagAgent,
  type GraphRagAgentResult,
  type GraphRagLlmClient,
} from './fixtures/ontology-graph-rag-agent-fixture.js';
import {
  createOpenAiGraphRagLlmClient,
  isOpenAiGraphRagUnavailable,
} from './fixtures/ontology-graph-rag-llm-fixture.js';
import {
  validateRequiredEntities,
} from './fixtures/ontology-graph-rag-evidence-fixture.js';
import {
  normalizePregnancyLisinoprilEvidence,
  normalizeCkdHeartFailureIbuprofenEvidence,
  normalizeAtrialFibrillationAlternativesEvidence,
  type PregnancyLisinoprilRow,
  type CkdHeartFailureIbuprofenRow,
  type AtrialFibrillationAlternativesRow,
} from './fixtures/ontology-graph-rag-evidence-normalization-fixture.js';
import {
  createOntologyLivePostgresProofFixture,
  executeOntologyGraphQuery,
} from './fixtures/ontology-live-postgres-proof-fixture.js';
import {
  createPregnancyLisinoprilEvidenceOperation,
  createCkdHeartFailureIbuprofenEvidenceOperation,
  createAtrialFibrillationAlternativesEvidenceOperation,
} from './fixtures/ontology-graph-rag-query-fixture.js';
import {
  allGraphRagScenarios,
  pregnancyLisinoprilHypertensionScenario,
  type GraphRagScenario,
} from './fixtures/ontology-graph-rag-scenarios-fixture.js';

describe('ontology graph rag e2e', () => {
  it('retrieves cited ontology evidence for every Graph RAG scenario through PostgreSQL graph queries', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const pregnancyRows = await executeOntologyGraphQuery<PregnancyLisinoprilRow>(
        fixture.sql,
        createPregnancyLisinoprilEvidenceOperation(),
      );
      expect(pregnancyRows.length).toBeGreaterThan(0);

      const pregnancyNormalized = normalizePregnancyLisinoprilEvidence(pregnancyRows);
      expect(pregnancyNormalized.scenarioId).toBe('pregnancy-lisinopril-hypertension');

      for (const requiredId of pregnancyLisinoprilHypertensionScenario.requiredEvidenceIds) {
        expect(
          pregnancyNormalized.retrievedEvidenceIds.has(requiredId),
          `Scenario A missing required evidence: ${requiredId}`,
        ).toBe(true);
      }

      const pregnancyEntityValidation = validateRequiredEntities(
        pregnancyNormalized.evidence,
        pregnancyLisinoprilHypertensionScenario.requiredEntityIds,
      );
      expect(pregnancyEntityValidation.isComplete).toBe(true);

      const ckdScenario = allGraphRagScenarios.find(
        (s) => s.scenarioId === 'ckd-heart-failure-ibuprofen',
      )!;
      const ckdRows = await executeOntologyGraphQuery<CkdHeartFailureIbuprofenRow>(
        fixture.sql,
        createCkdHeartFailureIbuprofenEvidenceOperation(),
      );
      expect(ckdRows.length).toBeGreaterThan(0);

      const ckdNormalized = normalizeCkdHeartFailureIbuprofenEvidence(ckdRows);
      expect(ckdNormalized.scenarioId).toBe('ckd-heart-failure-ibuprofen');

      for (const requiredId of ckdScenario.requiredEvidenceIds) {
        expect(
          ckdNormalized.retrievedEvidenceIds.has(requiredId),
          `Scenario B missing required evidence: ${requiredId}`,
        ).toBe(true);
      }

      const ckdEntityValidation = validateRequiredEntities(
        ckdNormalized.evidence,
        ckdScenario.requiredEntityIds,
      );
      expect(ckdEntityValidation.isComplete).toBe(true);

      const afScenario = allGraphRagScenarios.find(
        (s) => s.scenarioId === 'atrial-fibrillation-anticoagulant-alternatives',
      )!;
      const afRows = await executeOntologyGraphQuery<AtrialFibrillationAlternativesRow>(
        fixture.sql,
        createAtrialFibrillationAlternativesEvidenceOperation(),
      );
      expect(afRows.length).toBeGreaterThan(0);

      const afNormalized = normalizeAtrialFibrillationAlternativesEvidence(afRows);
      expect(afNormalized.scenarioId).toBe('atrial-fibrillation-anticoagulant-alternatives');

      for (const requiredId of afScenario.requiredEvidenceIds) {
        expect(
          afNormalized.retrievedEvidenceIds.has(requiredId),
          `Scenario C missing required evidence: ${requiredId}`,
        ).toBe(true);
      }

      const afEntityValidation = validateRequiredEntities(
        afNormalized.evidence,
        afScenario.requiredEntityIds,
      );
      expect(afEntityValidation.isComplete).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  it('does not call the LLM when required graph evidence is insufficient', async () => {
    let llmWasCalled = false;
    const fakeLlmClient: GraphRagLlmClient = {
      async answer() {
        llmWasCalled = true;
        throw new Error('LLM should not have been called');
      },
    };

    const agent = createGraphRagAgent({ llmClient: fakeLlmClient });
    const result = await agent.runScenario(pregnancyLisinoprilHypertensionScenario, []);

    expect(result.llmOutput?.status).toBe('insufficient_evidence');
    expect(result.validation.isComplete).toBe(false);
    expect(result.validation.missingEvidenceIds.length).toBeGreaterThan(0);
    expect(result.responseValidation).toBeUndefined();
    expect(llmWasCalled).toBe(false);
  });

  it.skipIf(isOpenAiGraphRagUnavailable())(
    'answers every Graph RAG clinical scenario with a live LLM and graph citations',
    { timeout: 60_000 },
    async () => {
      const fixture = await createOntologyLivePostgresProofFixture();

      try {
        const llmClient = createOpenAiGraphRagLlmClient();
        const agent = createGraphRagAgent({ llmClient });

        const pregnancyRows = await executeOntologyGraphQuery<PregnancyLisinoprilRow>(
          fixture.sql,
          createPregnancyLisinoprilEvidenceOperation(),
        );
        const pregnancyEvidence = normalizePregnancyLisinoprilEvidence(pregnancyRows);
        const pregnancyResult = await agent.runScenario(
          pregnancyLisinoprilHypertensionScenario,
          pregnancyEvidence.evidence,
        );
        assertAnsweredScenario(pregnancyResult, pregnancyLisinoprilHypertensionScenario);

        const ckdScenario = allGraphRagScenarios.find(
          (s) => s.scenarioId === 'ckd-heart-failure-ibuprofen',
        )!;
        const ckdRows = await executeOntologyGraphQuery<CkdHeartFailureIbuprofenRow>(
          fixture.sql,
          createCkdHeartFailureIbuprofenEvidenceOperation(),
        );
        const ckdEvidence = normalizeCkdHeartFailureIbuprofenEvidence(ckdRows);
        const ckdResult = await agent.runScenario(ckdScenario, ckdEvidence.evidence);
        assertAnsweredScenario(ckdResult, ckdScenario);

        const afScenario = allGraphRagScenarios.find(
          (s) => s.scenarioId === 'atrial-fibrillation-anticoagulant-alternatives',
        )!;
        const afRows = await executeOntologyGraphQuery<AtrialFibrillationAlternativesRow>(
          fixture.sql,
          createAtrialFibrillationAlternativesEvidenceOperation(),
        );
        const afEvidence = normalizeAtrialFibrillationAlternativesEvidence(afRows);
        const afResult = await agent.runScenario(afScenario, afEvidence.evidence);
        assertAnsweredScenario(afResult, afScenario);
      } finally {
        await fixture.cleanup();
      }
    },
  );
});

function assertAnsweredScenario(
  result: GraphRagAgentResult,
  scenario: GraphRagScenario,
): void {
  expect(result.llmOutput).toBeDefined();
  expect(result.llmOutput?.status).toBe('answered');
  expect(result.llmOutput?.scenarioId).toBe(scenario.scenarioId);

  const validation = result.responseValidation;
  expect(validation).toBeDefined();

  expect(
    validation?.hallucinatedCitationIds,
    `Scenario ${scenario.scenarioId} has hallucinated citations: ${String(validation?.hallucinatedCitationIds?.join(', '))}`,
  ).toEqual([]);

  expect(
    validation?.hallucinatedFindingCitationIds,
    `Scenario ${scenario.scenarioId} has hallucinated finding citations: ${String(validation?.hallucinatedFindingCitationIds?.join(', '))}`,
  ).toEqual([]);

  expect(
    validation?.isValid,
    `Scenario ${scenario.scenarioId} validation failed: uncited evidence [${String(validation?.uncitedRequiredEvidenceIds?.join(', '))}] missing entities [${String(validation?.missingRequiredEntityIds?.join(', '))}]`,
  ).toBe(true);

  for (const requiredId of scenario.requiredEvidenceIds) {
    const cited = result.llmOutput?.citations?.some((c) => c.evidenceId === requiredId);
    expect(
      cited,
      `Scenario ${scenario.scenarioId} missing required citation: ${requiredId}`,
    ).toBe(true);
  }

  const findingEntities = new Set<string>();
  for (const finding of result.llmOutput?.keyFindings ?? []) {
    findingEntities.add(finding.subjectId);
    findingEntities.add(finding.objectId);
  }
  for (const requiredEntity of scenario.requiredEntityIds) {
    expect(
      findingEntities.has(requiredEntity),
      `Scenario ${scenario.scenarioId} missing required entity in findings: ${requiredEntity}`,
    ).toBe(true);
  }
}

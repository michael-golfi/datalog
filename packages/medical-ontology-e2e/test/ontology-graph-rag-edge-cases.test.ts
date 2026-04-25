import { describe, expect, it } from 'vitest';

import {
  createGraphRagAgent,
  type GraphRagLlmClient,
  type GraphRagLlmOutput,
} from './fixtures/ontology-graph-rag-agent-fixture.js';
import {
  ckdHeartFailureIbuprofenScenario,
  pregnancyLisinoprilHypertensionScenario,
} from './fixtures/ontology-graph-rag-scenarios-fixture.js';

import type { GraphRagEvidence } from './fixtures/ontology-graph-rag-evidence-fixture.js';

describe('ontology graph rag edge cases', () => {
  describe('insufficient evidence short-circuits', () => {
    it('does not call the LLM when required graph evidence is insufficient', async () => {
      let llmWasCalled = false;
      const llmClient: GraphRagLlmClient = {
        async answer() {
          llmWasCalled = true;
          throw new Error('LLM should not have been called');
        },
      };

      const agent = createGraphRagAgent({ llmClient });
      const incompleteEvidence: readonly GraphRagEvidence[] = [
        {
          evidenceId: 'indication/lisinopril/hypertension',
          evidenceType: 'indication',
          subjectId: 'medication/lisinopril',
          predicateId: 'indicated_for',
          objectId: 'condition/hypertension',
        },
      ];

      const result = await agent.runScenario(
        pregnancyLisinoprilHypertensionScenario,
        incompleteEvidence,
      );

      expect(result.validation.isComplete).toBe(false);
      expect(result.validation.missingEvidenceIds).toEqual([
        'contraindication/lisinopril/pregnancy',
        'membership/lisinopril/ace_inhibitor',
        'mapping/rxnorm_29046',
        'mapping/umls_c0065374',
        'mapping/snomedct_38341003',
        'mapping/snomedct_77386006',
      ]);
      expect(result.llmOutput).toEqual({
        scenarioId: pregnancyLisinoprilHypertensionScenario.scenarioId,
        status: 'insufficient_evidence',
        answer: 'Missing required evidence: contraindication/lisinopril/pregnancy, membership/lisinopril/ace_inhibitor, mapping/rxnorm_29046, mapping/umls_c0065374, mapping/snomedct_38341003, mapping/snomedct_77386006',
        keyFindings: [],
        citations: [],
      });
      expect(result.responseValidation).toBeUndefined();
      expect(llmWasCalled).toBe(false);
    });

    it('returns insufficient_evidence for an empty evidence list', async () => {
      const llmClient: GraphRagLlmClient = {
        async answer() {
          throw new Error('LLM should not have been called');
        },
      };

      const agent = createGraphRagAgent({ llmClient });
      const result = await agent.runScenario(ckdHeartFailureIbuprofenScenario, []);

      expect(result.validation.isComplete).toBe(false);
      expect(result.validation.missingEvidenceIds).toEqual(
        ckdHeartFailureIbuprofenScenario.requiredEvidenceIds,
      );
      expect(result.llmOutput).toEqual({
        scenarioId: ckdHeartFailureIbuprofenScenario.scenarioId,
        status: 'insufficient_evidence',
        answer: `Missing required evidence: ${ckdHeartFailureIbuprofenScenario.requiredEvidenceIds.join(', ')}`,
        keyFindings: [],
        citations: [],
      });
      expect(result.responseValidation).toBeUndefined();
    });
  });

  describe('malformed answered responses stay invalid', () => {
    it('flags an answered response with the wrong scenario id as invalid', async () => {
      const llmClient: GraphRagLlmClient = {
        async answer(): Promise<GraphRagLlmOutput> {
          return {
            scenarioId: 'wrong-scenario',
            status: 'answered',
            answer: 'This should fail validation.',
            keyFindings: [],
            citations: [],
          };
        },
      };

      const agent = createGraphRagAgent({ llmClient });
      const completeEvidence = ckdHeartFailureIbuprofenScenario.requiredEvidenceIds.map((evidenceId) => ({
        evidenceId,
        evidenceType: classifyEvidenceType(evidenceId),
        subjectId: 'placeholder/subject',
        predicateId: 'placeholder/predicate',
        objectId: 'placeholder/object',
      } satisfies GraphRagEvidence));

      const result = await agent.runScenario(ckdHeartFailureIbuprofenScenario, completeEvidence);

      expect(result.validation.isComplete).toBe(true);
      expect(result.llmOutput?.status).toBe('answered');
      expect(result.responseValidation).toEqual({
        isValid: false,
        hallucinatedCitationIds: [],
        hallucinatedFindingCitationIds: [],
        uncitedRequiredEvidenceIds: ckdHeartFailureIbuprofenScenario.requiredEvidenceIds,
        missingRequiredEntityIds: ckdHeartFailureIbuprofenScenario.requiredEntityIds,
      });
    });
  });
});

function classifyEvidenceType(evidenceId: string): GraphRagEvidence['evidenceType'] {
  if (evidenceId.startsWith('contraindication/')) {
    return 'contraindication';
  }

  if (evidenceId.startsWith('comorbidity/')) {
    return 'comorbidity';
  }

  if (evidenceId.startsWith('membership/')) {
    return 'drug_class';
  }

  return 'mapping';
}

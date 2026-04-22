import { applyDatalogFacts } from '@datalog/datalog-to-sql';
import { describe, expect, it } from 'vitest';

import {
  createOntologyLivePostgresProofFixture,
  executeOntologyGraphQuery,
} from './fixtures/ontology-live-postgres-proof-fixture.js';

describe('ontology graph query round trip', () => {
  it('retrieves a known ontology vertex by id through translated graph operations', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const result = await executeOntologyGraphQuery<{ id: string }>(fixture.sql, {
        kind: 'select-vertex-by-id',
        vertexId: 'medication/metformin',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('medication/metformin');
    } finally {
      await fixture.cleanup();
    }
  });

  it('retrieves preferred labels for ontology nodes through select-facts variable binding', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const result = await executeOntologyGraphQuery<{ label: string }>(fixture.sql, {
        kind: 'select-facts',
        match: [
          graphEdge(
            graphConstant('condition/type_2_diabetes'),
            'onto/preferred_label',
            graphVariable('label'),
          ),
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.label).toBe('Type 2 Diabetes Mellitus');
    } finally {
      await fixture.cleanup();
    }
  });

  it('traverses from medication through drug class membership to drug class label', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const result = await executeOntologyGraphQuery<{
        medication: string;
        drug_class: string;
        drug_class_label: string;
      }>(fixture.sql, {
        kind: 'select-facts',
        match: [
          graphEdge(
            graphConstant('medication/metformin'),
            'med/has_drug_class',
            graphVariable('drug_class'),
          ),
          graphEdge(
            graphVariable('drug_class'),
            'onto/preferred_label',
            graphVariable('drug_class_label'),
          ),
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.drug_class).toBe('drug_class/biguanide');
      expect(result[0]?.drug_class_label).toBe('Biguanide');
    } finally {
      await fixture.cleanup();
    }
  });

  it('proves fact deletion removes persisted data from the graph', async () => {
    const fixture = await createOntologyLivePostgresProofFixture();

    try {
      const beforeDelete = await executeOntologyGraphQuery<{ label: string }>(fixture.sql, {
        kind: 'select-facts',
        match: [
          graphEdge(
            graphConstant('medication/metformin'),
            'onto/preferred_label',
            graphVariable('label'),
          ),
        ],
      });

      expect(beforeDelete.length).toBeGreaterThan(0);

      await applyDatalogFacts({
        sql: fixture.sql,
        mode: 'delete-facts',
        facts: [{
          kind: 'edge',
          subjectId: 'medication/metformin',
          predicateId: 'onto/preferred_label',
          objectId: 'Metformin',
        }],
      });

      const afterDelete = await executeOntologyGraphQuery<{ label: string }>(fixture.sql, {
        kind: 'select-facts',
        match: [
          graphEdge(
            graphConstant('medication/metformin'),
            'onto/preferred_label',
            graphVariable('label'),
          ),
        ],
      });

      expect(afterDelete).toHaveLength(0);
    } finally {
      await fixture.cleanup();
    }
  });
});

function graphConstant(value: string) {
  return { kind: 'constant' as const, value };
}

function graphVariable(name: string) {
  return { kind: 'variable' as const, name };
}

function graphEdge(
  subject: ReturnType<typeof graphConstant> | ReturnType<typeof graphVariable>,
  predicate: string,
  object: ReturnType<typeof graphConstant> | ReturnType<typeof graphVariable>,
) {
  return {
    kind: 'edge' as const,
    subject,
    predicate: graphConstant(predicate),
    object,
  };
}

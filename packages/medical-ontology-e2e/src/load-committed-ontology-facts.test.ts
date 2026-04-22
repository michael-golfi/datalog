import { describe, expect, it } from 'vitest';

import { loadCommittedOntologyFacts } from './load-committed-ontology-facts.js';

describe('loadCommittedOntologyFacts', () => {
  it('loads queryable edge facts from the committed flat migration chain', () => {
    const facts = loadCommittedOntologyFacts();

    expect(facts.some((fact) => fact.kind === 'vertex' && fact.id === 'concept/acetaminophen')).toBe(true);
    expect(
      facts.some(
        (fact) => fact.kind === 'edge'
          && fact.subjectId === 'concept/acetaminophen'
          && fact.predicateId === 'graph/has_foreign_identifier'
          && fact.objectId === 'foreign-id/umls-cui-C0000970',
      ),
    ).toBe(true);
  });
});

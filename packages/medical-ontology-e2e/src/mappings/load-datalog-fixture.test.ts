import { describe, expect, it } from 'vitest';

import { resolveMedicalOntologyWorkspacePath } from '../project/resolve-medical-ontology-workspace-path.js';
import { loadDatalogFixture } from './load-datalog-fixture.js';

describe('loadDatalogFixture', () => {
  it('loads immutable canonical fixture facts and infers vertex facts from referenced edge ids', () => {
    const facts = loadDatalogFixture(
      resolveMedicalOntologyWorkspacePath('migrations', '2026-04-21-ontology-a-core', 'ontology.dl'),
    );

    expect(facts.some((fact) => fact.kind === 'vertex' && fact.id === 'concept/acetaminophen')).toBe(true);
    expect(
      facts.some(
        (fact) => fact.kind === 'edge'
          && fact.subjectId === 'concept/acetaminophen'
          && fact.predicateId === 'graph/has_foreign_identifier'
          && fact.objectId === 'foreign-id/rxnorm-rxcui-161',
      ),
    ).toBe(true);
    expect(
      facts.some(
        (fact) => fact.kind === 'edge'
          && fact.subjectId === 'relation/acetaminophen-500mg-tablet-ingredient'
          && fact.predicateId === 'graph/relation_strength_unit'
          && fact.objectId === 'unit/mg',
      ),
    ).toBe(true);
  });
});

import { readFileSync } from 'node:fs';

import { parseDocument } from '@datalog/parser';
import { describe, expect, it } from 'vitest';

import { resolveMedicalOntologyWorkspacePath } from '../project/resolve-medical-ontology-workspace-path.js';

describe('canonical ontology schema structure', () => {
  it('proves compounds exist for foreign identifiers and medication presentations', () => {
    const parsed = parseDocument(readCanonicalOntologySource());

    expect(parsed.compoundPredicates.has('ForeignIdentifier')).toBe(true);
    expect(parsed.compoundPredicates.has('MedicationPresentation')).toBe(true);
    expect(parsed.compoundPredicates.has('IngredientStrengthRelation')).toBe(true);
  });

  it('proves typed foreign backlinks and a genuine n-ary relation instance exist', () => {
    const edges = getEdgeTuples();

    expect(edges).toContainEqual([
      'concept/acetaminophen',
      'graph/has_foreign_identifier',
      'foreign-id/rxnorm-rxcui-161',
    ]);
    expect(edges).toContainEqual([
      'concept/acetaminophen',
      'graph/has_foreign_identifier',
      'foreign-id/umls-cui-C0000970',
    ]);
    expect(edges).toContainEqual([
      'foreign-id/umls-cui-C0000970',
      'graph/in_source_graph',
      'source-graph/umls',
    ]);
    expect(edges).toContainEqual([
      'concept/acetaminophen-500mg-oral-tablet',
      'graph/has_ingredient_relation',
      'relation/acetaminophen-500mg-tablet-ingredient',
    ]);
    expect(edges).toContainEqual([
      'relation/acetaminophen-500mg-tablet-ingredient',
      'graph/relation_ingredient',
      'concept/acetaminophen',
    ]);
    expect(edges).toContainEqual([
      'relation/acetaminophen-500mg-tablet-ingredient',
      'graph/relation_strength_unit',
      'unit/mg',
    ]);
  });

  it('proves canonical schema normalizes source concepts instead of mirroring source-native graphs', () => {
    const edges = getEdgeTuples();

    expect(edges).not.toContainEqual(['umls/cui/C0000970', 'graph/mapped_to', 'rxnorm/rxcui/161']);
    expect(edges).not.toContainEqual(['rxnorm/rxcui/1049630', 'graph/has_ingredient', 'rxnorm/rxcui/161']);
    expect(edges).not.toContainEqual(['snomed/387458008', 'graph/is_a', 'snomed/10509002']);
    expect(edges).toContainEqual([
      'concept/acute-bronchitis',
      'graph/is_a',
      'concept/bronchitis-disorder',
    ]);
  });
});

function readCanonicalOntologySource(): string {
  return [
    readFileSync(resolveMedicalOntologyWorkspacePath('migrations', '2026-04-21-ontology-a-core', 'ontology.dl'), 'utf8'),
    readFileSync(resolveMedicalOntologyWorkspacePath('migrations', '2026-04-21-ontology-b-core', 'ontology.dl'), 'utf8'),
    readFileSync(resolveMedicalOntologyWorkspacePath('migrations', '2026-04-21-ontology-c-core', 'ontology.dl'), 'utf8'),
  ].join('\n');
}

function getEdgeTuples(): Array<readonly [string, string, string]> {
  const parsed = parseDocument(readCanonicalOntologySource());

  return parsed.clauses
    .filter((clause) => clause.predicate === 'Edge')
    .map((clause) => {
      const [subject, predicate, object] = clause.references;

      if (!subject || !predicate || !object) {
        throw new Error('Expected canonical ontology Edge fact to have three string references.');
      }

      return [subject.value, predicate.value, object.value] as const;
    });
}

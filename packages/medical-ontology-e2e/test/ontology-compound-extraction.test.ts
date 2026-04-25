import { DatalogMigrationSchemaError, loadDatalogMigrationProjectFiles } from '@datalog/datalog-migrate';
import { parseDocument } from '@datalog/parser';
import { describe, expect, it } from 'vitest';

import { resolveMedicalOntologyWorkspacePath } from './fixtures/medical-ontology-workspace-path-support.js';
import {
  extractOntologyFactsFromMigrations,
  extractOntologyFactsFromSource,
} from './fixtures/ontology-migration-fact-extraction-fixture.js';

describe('ontology compound extraction', () => {
  it('derives committed ontology backlinks from schema-declared compound fields', () => {
    const projectFiles = loadDatalogMigrationProjectFiles({
      workspaceRoot: resolveMedicalOntologyWorkspacePath(),
    });
    const extraction = extractOntologyFactsFromMigrations(projectFiles.committedMigrations);
    const committedCompoundClauses = projectFiles.committedMigrations.flatMap((migration) =>
      parseDocument(migration.body).clauses.filter((clause) => clause.isCompound && clause.predicate !== 'DefCompound'));
    const mappingClauseCount = committedCompoundClauses.filter((clause) => clause.predicate === 'ExternalMapping').length;
    const membershipClauseCount = committedCompoundClauses.filter((clause) => clause.predicate === 'MedicationClassMembership').length;

    expect(extraction.edges.filter((edge) => edge.predicateId === 'med/has_mapping')).toHaveLength(mappingClauseCount);
    expect(extraction.edges.filter((edge) => edge.predicateId === 'med/has_drug_class')).toHaveLength(membershipClauseCount);
    expect(extraction.edges).toContainEqual({
      kind: 'edge',
      subjectId: 'medication/metformin',
      predicateId: 'med/has_mapping',
      objectId: 'mapping/atc_a10ba02',
    });
    expect(extraction.edges).toContainEqual({
      kind: 'edge',
      subjectId: 'mapping/atc_a10ba02',
      predicateId: 'mapping/concept',
      objectId: 'medication/metformin',
    });
    expect(extraction.edges).toContainEqual({
      kind: 'edge',
      subjectId: 'medication/metformin',
      predicateId: 'med/has_drug_class',
      objectId: 'drug_class/biguanide',
    });
  });

  it('rejects ontology backlink extraction when the compound schema omits a required backlink field', () => {
    const source = [
      'DefCompound("MedicationClassMembership", "clinical/medicine", "0", "liquid/node").',
      'DefCompound("MedicationClassMembership", "clinical/drug_class", "0", "liquid/node").',
      'MedicationClassMembership@(cid="membership/metformin/biguanide", clinical/medicine="medication/metformin", clinical/drug_class="drug_class/biguanide").',
      '',
    ].join('\n');

    expect(() => extractOntologyFactsFromSource(source)).toThrow(
      'Compound schema MedicationClassMembership must declare field clinical/medication for ontology backlink extraction.',
    );
  });

  it('rejects compound assertions that use undocumented fields', () => {
    const source = [
      'DefCompound("Indication", "clinical/medication", "0", "liquid/node").',
      'DefCompound("Indication", "clinical/condition", "0", "liquid/node").',
      'Indication@(cid="indication/metformin/type_2_diabetes", clinical/medication="medication/metformin", clinical/condition="condition/type_2_diabetes", clinical/source="source/starter_canon").',
      '',
    ].join('\n');

    expect(() => extractOntologyFactsFromSource(source)).toThrow(DatalogMigrationSchemaError);
    expect(() => extractOntologyFactsFromSource(source)).toThrow(
      'Compound fact Indication@ uses undeclared field clinical/source.',
    );
  });
});

import { describe, expect, it } from 'vitest';

import { generateCompoundIdentity, isDatalogSchema, isDefCompoundSchema } from '@datalog/ast';
import { extractDatalogSchemaFromMigrations, loadDatalogMigrationProjectFiles } from '@datalog/datalog-migrate';
import { parseDocument } from '@datalog/parser';

import { resolveMedicalOntologyWorkspacePath } from './fixtures/medical-ontology-workspace-path-support.js';

describe('ontology schema invariants', () => {
  const projectFiles = loadDatalogMigrationProjectFiles({
    workspaceRoot: resolveMedicalOntologyWorkspacePath(),
  });
  const schemas = extractDatalogSchemaFromMigrations(projectFiles.committedMigrations);
  const compoundSchemas = schemas.filter(isDefCompoundSchema);
  const schemaByCompoundName = new Map(compoundSchemas.map((schema) => [schema.compoundName, schema]));
  const compoundClauses = projectFiles.committedMigrations.flatMap((migration) =>
    parseDocument(migration.body).clauses.filter((clause) =>
      clause.isCompound && clause.predicate !== 'DefCompound' && clause.predicate !== 'DefPred'));

  it('turns committed DefPred and DefCompound declarations into valid shared datalog schemas', () => {
    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas.every(isDatalogSchema)).toBe(true);
    expect(schemas).toContainEqual(expect.objectContaining({ kind: 'predicate-schema', predicateName: 'onto/preferred_label' }));
    expect(schemas).toContainEqual(expect.objectContaining({ kind: 'compound-schema', compoundName: 'ExternalMapping' }));
  });

  it('requires committed compound assertions to provide string cid identity fields', () => {
    expect(compoundClauses.length).toBeGreaterThan(0);

    for (const clause of compoundClauses) {
      const cidIndex = clause.compoundFields.indexOf('cid');
      expect(cidIndex).toBeGreaterThanOrEqual(0);
      expect(clause.references[cidIndex]?.value).toEqual(expect.any(String));
      expect(schemaByCompoundName.has(clause.predicate)).toBe(true);
    }
  });

  it('generates deterministic order-independent relative identities from committed ontology field values', () => {
    const externalMappingClause = compoundClauses.find((clause) => clause.predicate === 'ExternalMapping');

    expect(externalMappingClause).toBeDefined();

    for (const clause of compoundClauses) {
      const schema = schemaByCompoundName.get(clause.predicate);
      expect(schema).toBeDefined();

      if (schema === undefined) {
        continue;
      }

      const orderedFieldValues = collectCompoundFieldValues(clause);
      const reversedFieldValues = new Map([...orderedFieldValues.entries()].reverse());
      const generatedIdentity = generateCompoundIdentity(schema, orderedFieldValues);

      expect(generateCompoundIdentity(schema, reversedFieldValues)).toBe(generatedIdentity);
      expect(generatedIdentity.startsWith(`${schema.compoundName}:`)).toBe(true);
    }

    if (externalMappingClause !== undefined) {
      const schema = schemaByCompoundName.get(externalMappingClause.predicate);
      expect(schema).toBeDefined();

      if (schema !== undefined) {
        expect(generateCompoundIdentity(schema, collectCompoundFieldValues(externalMappingClause))).toBe(
          'ExternalMapping:mapping/code=A10BA02,mapping/concept=medication/metformin,mapping/vocabulary=vocab/atc',
        );
      }
    }
  });
});

function collectCompoundFieldValues(
  clause: ReturnType<typeof parseDocument>['clauses'][number],
): ReadonlyMap<string, string> {
  const fieldValues = new Map<string, string>();

  for (const [index, fieldName] of clause.compoundFields.entries()) {
    const reference = clause.references[index];

    if (reference !== undefined && fieldName !== 'cid') {
      fieldValues.set(fieldName, reference.value);
    }
  }

  return fieldValues;
}

import {
  defPredSchema,
  edgeFact,
  type DatalogFact,
  type DatalogSchema,
  type DefCompoundSchema,
  type EdgeFact,
  vertexFact,
  type VertexFact,
} from '@datalog/ast';
import {
  extractDatalogFactsFromMigrations,
  extractDatalogSchemaFromMigrations,
  type CompoundBacklinkExpander,
} from '@datalog/datalog-migrate';
import { parseDocument } from '@datalog/parser';

export type OntologyVertexFact = VertexFact;
export type OntologyEdgeFact = EdgeFact;
export type OntologyFact = DatalogFact;

export interface OntologyMigrationFactExtraction {
  readonly vertices: readonly OntologyVertexFact[];
  readonly edges: readonly OntologyEdgeFact[];
  readonly facts: readonly OntologyFact[];
}

interface OntologyCompoundBacklinkSpec {
  readonly compoundName: string;
  readonly predicateId: string;
  readonly subjectFieldName: string;
  readonly objectFieldName?: string;
  readonly useCidAsObject?: boolean;
}

const ONTOLOGY_COMPOUND_BACKLINK_SPECS = new Map<string, OntologyCompoundBacklinkSpec>([
  [
    'ExternalMapping',
    {
      compoundName: 'ExternalMapping',
      predicateId: 'med/has_mapping',
      subjectFieldName: 'mapping/concept',
      useCidAsObject: true,
    },
  ],
  [
    'MedicationClassMembership',
    {
      compoundName: 'MedicationClassMembership',
      predicateId: 'med/has_drug_class',
      subjectFieldName: 'clinical/medication',
      objectFieldName: 'clinical/drug_class',
    },
  ],
]);

const ONTOLOGY_SUPPORTING_SCHEMAS: readonly DatalogSchema[] = [
  defPredSchema({
    predicateName: 'liquid/mutable',
    subjectCardinality: '1',
    subjectDomain: 'node',
    objectCardinality: '?',
    objectDomain: 'text',
  }),
];

export function extractOntologyFactsFromSource(source: string): OntologyMigrationFactExtraction {
  return extractOntologyFactsFromMigrations([{ body: source }]);
}

export function extractOntologyFactsFromMigrations(
  migrations: ReadonlyArray<{ readonly body: string }>,
): OntologyMigrationFactExtraction {
  const schemas = mergeOntologySupportingSchemas(extractDatalogSchemaFromMigrations(migrations));
  const extraction = extractDatalogFactsFromMigrations(migrations, {
    schemas,
    compoundBacklinkExpander: expandOntologyCompoundBacklink,
  });
  const compoundFieldEdges = extractCompoundFieldEdgesFromMigrations(migrations, schemas);
  const vertexIds = new Set(extraction.vertices.map((vertex) => vertex.id));
  const edges = [...extraction.edges, ...compoundFieldEdges];

  for (const edge of edges) {
    vertexIds.add(edge.subjectId);
    vertexIds.add(edge.objectId);
  }

  const vertices = [...vertexIds].map<OntologyVertexFact>((id) => vertexFact(id));
  const facts = [...vertices, ...edges];

  return {
    vertices,
    edges,
    facts,
  };
}

function mergeOntologySupportingSchemas(schemas: readonly DatalogSchema[]): readonly DatalogSchema[] {
  return [...schemas, ...ONTOLOGY_SUPPORTING_SCHEMAS.filter((supportingSchema) =>
    schemas.every((schema) => schema.kind !== 'predicate-schema' || supportingSchema.kind !== 'predicate-schema'
      || schema.predicateName !== supportingSchema.predicateName))];
}

function extractCompoundFieldEdgesFromMigrations(
  migrations: ReadonlyArray<{ readonly body: string }>,
  schemas: readonly DatalogSchema[],
): readonly EdgeFact[] {
  const compoundSchemas = new Map(
    schemas
      .filter((schema): schema is DefCompoundSchema => schema.kind === 'compound-schema')
      .map((schema) => [schema.compoundName, schema]),
  );
  const edges: EdgeFact[] = [];

  for (const migration of migrations) {
    for (const clause of parseDocument(migration.body).clauses) {
      if (!clause.isCompound || clause.predicate === 'DefCompound' || clause.predicate === 'DefPred') {
        continue;
      }

      const schema = compoundSchemas.get(clause.predicate);

      if (schema === undefined) {
        continue;
      }

      const fieldValues = collectCompoundFieldValues(clause);
      const cid = fieldValues.get('cid');

      if (cid === undefined) {
        continue;
      }

      for (const field of schema.fields) {
        const value = fieldValues.get(field.fieldName);

        if (value === undefined) {
          continue;
        }

        edges.push(edgeFact({
          subjectId: cid,
          predicateId: field.fieldName,
          objectId: value,
        }));
      }
    }
  }

  return edges;
}

const expandOntologyCompoundBacklink: CompoundBacklinkExpander = ({ clause, schema }) => {
  const backlinkSpec = ONTOLOGY_COMPOUND_BACKLINK_SPECS.get(schema.compoundName);

  if (backlinkSpec === undefined) {
    return null;
  }

  if (clause.predicate !== schema.compoundName) {
    throw new Error(`Expected compound clause ${clause.predicate} to match schema ${schema.compoundName}.`);
  }

  const fieldValues = collectCompoundFieldValues(clause);
  const subjectId = getRequiredCompoundFieldValue({
    schema,
    fieldName: backlinkSpec.subjectFieldName,
    fieldValues,
  });
  const objectId = backlinkSpec.useCidAsObject === true
    ? getRequiredCompoundIdentity(fieldValues, schema)
    : getRequiredCompoundFieldValue({
        schema,
        fieldName: backlinkSpec.objectFieldName,
        fieldValues,
      });

  return edgeFact({
    subjectId,
    predicateId: backlinkSpec.predicateId,
    objectId,
  });
};

function collectCompoundFieldValues(
  clause: Parameters<CompoundBacklinkExpander>[0]['clause'],
): ReadonlyMap<string, string> {
  const fieldValues = new Map<string, string>();

  for (const [index, fieldName] of clause.compoundFields.entries()) {
    const reference = clause.references[index];

    if (reference !== undefined) {
      fieldValues.set(fieldName, reference.value);
    }
  }

  return fieldValues;
}

function getRequiredCompoundIdentity(
  fieldValues: ReadonlyMap<string, string>,
  schema: DefCompoundSchema,
): string {
  const cid = fieldValues.get('cid');

  if (cid === undefined) {
    throw new Error(`Compound ${schema.compoundName}@ must provide a cid field for ontology backlink extraction.`);
  }

  return cid;
}

function getRequiredCompoundFieldValue(input: {
  readonly schema: DefCompoundSchema;
  readonly fieldName: string | undefined;
  readonly fieldValues: ReadonlyMap<string, string>;
}): string {
  if (input.fieldName === undefined) {
    throw new Error(`Compound ${input.schema.compoundName} backlink extraction requires a declared field name.`);
  }

  assertSchemaDeclaresField(input.schema, input.fieldName);
  const value = input.fieldValues.get(input.fieldName);

  if (value === undefined) {
    throw new Error(`Compound ${input.schema.compoundName}@ must provide field ${input.fieldName} for ontology backlink extraction.`);
  }

  return value;
}

function assertSchemaDeclaresField(schema: DefCompoundSchema, fieldName: string): void {
  if (schema.fields.some((field) => field.fieldName === fieldName)) {
    return;
  }

  throw new Error(`Compound schema ${schema.compoundName} must declare field ${fieldName} for ontology backlink extraction.`);
}

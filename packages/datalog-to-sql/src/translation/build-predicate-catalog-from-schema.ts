import type {
  Cardinality,
  DatalogSchema,
  DefCompoundFieldSchema,
  DefCompoundSchema,
  DefPredSchema,
  DatalogTypeName,
} from '@datalog/ast';

import { GraphTranslationError } from '../contracts/graph-translation-error.js';

import type {
  PredicateBinding,
  PredicateCapabilities,
  PredicateCatalog,
  RelationColumnBinding,
} from '../contracts/predicate-catalog.js';

const READ_ONLY_SQL_CAPABILITIES = {
  readable: true,
  writable: false,
  supportsPredicatePushdown: true,
  supportsJoinPushdown: true,
  supportsAggregationPushdown: false,
  supportsRecursionSeedPushdown: false,
  supportsDeltaScan: false,
} satisfies PredicateCapabilities;

/** Build a SQL predicate catalog from shared Datalog schema declarations. */
export function buildPredicateCatalogFromSchema(schemas: readonly DatalogSchema[]): PredicateCatalog {
  return {
    version: 1,
    predicates: schemas.map((schema) => buildPredicateBinding(schema)),
    aliases: {
      Vertex: 'vertex',
      Node: 'vertex',
      Edge: 'edge',
    },
  };
}

function buildPredicateBinding(schema: DatalogSchema): PredicateBinding {
  if (schema.kind === 'predicate-schema') {
    return buildPredicateSchemaBinding(schema);
  }

  return buildCompoundSchemaBinding(schema);
}

function buildPredicateSchemaBinding(schema: DefPredSchema): PredicateBinding {
  const graphBinding = buildGraphPredicateBinding(schema);

  if (graphBinding !== null) {
    return graphBinding;
  }

  const subjectType = mapScalarDomainToDatalogType(schema.subjectDomain, `${schema.predicateName} subject`);
  const objectType = mapScalarDomainToDatalogType(schema.objectDomain, `${schema.predicateName} object`);

  return {
    signature: {
      name: schema.predicateName,
      arity: 2,
      kind: 'edb',
      outputTypes: [subjectType, objectType],
    },
    source: 'catalog',
    storage: {
      kind: 'postgres-table',
      relationName: 'edges',
      columns: [
        { name: 'subject_id', ordinal: 0, type: subjectType },
        { name: 'object_id', ordinal: 1, type: objectType },
      ],
      literalWhereSql: `predicate_id = '${escapeSqlLiteral(schema.predicateName)}'`,
    },
    constraints: [],
    indexes: [],
    capabilities: READ_ONLY_SQL_CAPABILITIES,
  };
}

function buildCompoundSchemaBinding(schema: DefCompoundSchema): PredicateBinding {
  const columns = schema.fields.map((field, index) => buildCompoundFieldColumn(field, index));

  return {
    signature: {
      name: schema.compoundName,
      arity: columns.length,
      kind: 'edb',
      outputTypes: columns.map((column) => column.type),
    },
    source: 'catalog',
    storage: {
      kind: 'postgres-view',
      relationName: schema.compoundName,
      columns,
      definitionSql: renderCompoundDefinitionSql(schema),
    },
    constraints: [],
    indexes: [],
    capabilities: READ_ONLY_SQL_CAPABILITIES,
  };
}

function buildGraphPredicateBinding(schema: DefPredSchema): PredicateBinding | null {
  const normalizedName = schema.predicateName.toLowerCase();

  if (normalizedName === 'vertex' || normalizedName === 'node') {
    return createVertexPredicateBinding();
  }

  if (normalizedName === 'edge') {
    return createEdgePredicateBinding();
  }

  return null;
}

function createVertexPredicateBinding(): PredicateBinding {
  return {
    signature: {
      name: 'vertex',
      arity: 1,
      kind: 'edb',
      outputTypes: ['text'],
    },
    source: 'catalog',
    storage: {
      kind: 'postgres-table',
      relationName: 'vertices',
      columns: [{ name: 'id', ordinal: 0, type: 'text' }],
    },
    constraints: [],
    indexes: [],
    capabilities: READ_ONLY_SQL_CAPABILITIES,
  };
}

function createEdgePredicateBinding(): PredicateBinding {
  return {
    signature: {
      name: 'edge',
      arity: 3,
      kind: 'edb',
      outputTypes: ['text', 'text', 'text'],
    },
    source: 'catalog',
    storage: {
      kind: 'postgres-table',
      relationName: 'edges',
      columns: [
        { name: 'subject_id', ordinal: 0, type: 'text' },
        { name: 'predicate_id', ordinal: 1, type: 'text' },
        { name: 'object_id', ordinal: 2, type: 'text' },
      ],
    },
    constraints: [],
    indexes: [],
    capabilities: READ_ONLY_SQL_CAPABILITIES,
  };
}

function buildCompoundFieldColumn(field: DefCompoundFieldSchema, ordinal: number): RelationColumnBinding {
  return {
    name: field.fieldName,
    ordinal,
    type: mapScalarDomainToDatalogType(field.domain, `${field.fieldName} field`),
    nullable: isOptionalField(field.cardinality),
  };
}

function renderCompoundDefinitionSql(schema: DefCompoundSchema): string {
  const selectColumns = schema.fields.map((field, index) => {
    return `field_${index + 1}.object_id as ${quoteIdentifier(field.fieldName)}`;
  }).join(', ');

  const joins = schema.fields.map((field, index) => {
    const joinKeyword = requiresCompoundFieldRow(field.cardinality) ? 'join' : 'left join';
    return `${joinKeyword} edges field_${index + 1} on field_${index + 1}.subject_id = hub.id and field_${index + 1}.predicate_id = '${escapeSqlLiteral(field.fieldName)}'`;
  }).join(' ');

  return `select ${selectColumns} from vertices hub ${joins} where hub.id like '${escapeSqlLikePattern(schema.compoundName)}:%'`;
}

function mapScalarDomainToDatalogType(domain: string, context: string): DatalogTypeName {
  if (domain === 'node') {
    return 'text';
  }

  const datalogType = getScalarDatalogType(domain);

  if (datalogType !== null) {
    return datalogType;
  }

  throw new GraphTranslationError(
    'datalog-to-sql.schema.unsupported-scalar-domain',
    `Unsupported scalar domain ${domain} for ${context}.`,
  );
}

function getScalarDatalogType(domain: string): DatalogTypeName | null {
  const scalarDomainTypes = new Set<DatalogTypeName>([
    'text',
    'int8',
    'numeric',
    'bool',
    'jsonb',
    'date',
    'timestamp',
  ]);

  if (scalarDomainTypes.has(domain as DatalogTypeName)) {
    return domain as DatalogTypeName;
  }

  return null;
}

function isOptionalField(cardinality: Cardinality): boolean {
  return cardinality === '0' || cardinality === '?' || cardinality === '*';
}

function requiresCompoundFieldRow(cardinality: Cardinality): boolean {
  return cardinality === '1' || cardinality === '+';
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function escapeSqlLikePattern(value: string): string {
  return escapeSqlLiteral(value).replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

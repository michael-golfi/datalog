import type {
  DatalogFactPattern,
  DatalogTerm,
  SelectFactsOperation,
} from '../contracts/postgres-graph-operation.js';
import type { TranslatedSqlQuery } from '../contracts/translated-sql-query.js';

interface BindingReference {
  readonly alias: string;
  readonly column: string;
}

/** Translate a Datalog fact query into a generic SQL select over vertices and edges. */
export function translateDatalogFactQuery(operation: SelectFactsOperation): TranslatedSqlQuery {
  const bindings = new Map<string, BindingReference>();
  const selects: string[] = [];
  const from: string[] = [];
  const where: string[] = [];
  const values: string[] = [];

  for (const [index, pattern] of operation.match.entries()) {
    const alias = `${pattern.kind}_${index + 1}`;
    from.push(`${getTableName(pattern)} ${alias}`);

    if (pattern.kind === 'vertex') {
      bindTerm({ alias, column: 'id', term: pattern.id, bindings, selects, where, values });
      continue;
    }

    bindTerm({ alias, column: 'subject_id', term: pattern.subject, bindings, selects, where, values });
    bindTerm({ alias, column: 'predicate_id', term: pattern.predicate, bindings, selects, where, values });
    bindTerm({ alias, column: 'object_id', term: pattern.object, bindings, selects, where, values });
  }

  return {
    operation: 'select',
    text: buildSelectStatement(selects, from, where),
    values,
  };
}

function getTableName(pattern: DatalogFactPattern): 'vertices' | 'edges' {
  return pattern.kind === 'vertex' ? 'vertices' : 'edges';
}

function bindTerm(input: {
  readonly alias: string;
  readonly column: string;
  readonly term: DatalogTerm;
  readonly bindings: Map<string, BindingReference>;
  readonly selects: string[];
  readonly where: string[];
  readonly values: string[];
}): void {
  const qualifiedColumn = `${input.alias}.${input.column}`;

  if (input.term.kind === 'constant') {
    input.values.push(input.term.value);
    input.where.push(`${qualifiedColumn} = $${input.values.length}`);
    return;
  }

  const existing = input.bindings.get(input.term.name);
  if (existing !== undefined) {
    input.where.push(`${qualifiedColumn} = ${existing.alias}.${existing.column}`);
    return;
  }

  input.bindings.set(input.term.name, {
    alias: input.alias,
    column: input.column,
  });
  input.selects.push(`${qualifiedColumn} as ${quoteIdentifier(input.term.name)}`);
}

function buildSelectStatement(selects: readonly string[], from: readonly string[], where: readonly string[]): string {
  const selectedColumns = selects.length === 0 ? '1' : selects.join(', ');
  const whereClause = where.length === 0 ? '' : ` where ${where.join(' and ')}`;

  return `select distinct ${selectedColumns} from ${from.join(', ')}${whereClause};`;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

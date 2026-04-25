import type { DatalogSchema, DefCompoundSchema, DefPredSchema } from '@datalog/ast';
import {
  extractDatalogSchema,
  extractDefCompoundSchemas,
  extractDefPredSchema,
  parseDocument,
  type ParsedClause,
} from '@datalog/parser';

/** Structured migration-schema error raised for invalid declarations and schema-aware fact failures. */
export class DatalogMigrationSchemaError extends Error {
  override readonly cause?: unknown;

  constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly details: {
      readonly migrationFileName?: string;
      readonly migrationIndex: number;
      readonly predicate: string;
    };
    readonly options?: {
      readonly cause?: unknown;
    };
  }) {
    super(input.message);
    this.name = 'DatalogMigrationSchemaError';
    this.code = input.code;
    this.details = input.details;
    this.cause = input.options?.cause;
  }

  readonly code: string;

  readonly details: {
    readonly migrationFileName?: string;
    readonly migrationIndex: number;
    readonly predicate: string;
  };
}

/** Parse committed migrations and return their normalized shared schema declarations. */
export function extractDatalogSchemaFromMigrations(
  migrations: ReadonlyArray<{ readonly body: string; readonly fileName?: string }>,
): readonly DatalogSchema[] {
  const allClauses: ParsedClause[] = [];

  migrations.forEach((migration, migrationIndex) => {
    const clauses = parseDocument(migration.body).clauses;
    validateSchemaDeclarations(clauses, migrationIndex, migration.fileName);
    allClauses.push(...clauses);
  });

  return extractDatalogSchema(allClauses).map((declaration) => declaration.schema);
}

/** Index predicate schemas by predicate name for migration-time lookup. */
export function getDefPredSchemasByPredicateName(
  schemas: readonly DatalogSchema[],
): ReadonlyMap<string, DefPredSchema> {
  return new Map(
    schemas
      .filter((schema): schema is DefPredSchema => schema.kind === 'predicate-schema')
      .map((schema) => [schema.predicateName, schema]),
  );
}

/** Index compound schemas by compound name for migration-time lookup. */
export function getDefCompoundSchemasByCompoundName(
  schemas: readonly DatalogSchema[],
): ReadonlyMap<string, DefCompoundSchema> {
  return new Map(
    schemas
      .filter((schema): schema is DefCompoundSchema => schema.kind === 'compound-schema')
      .map((schema) => [schema.compoundName, schema]),
  );
}

function validateSchemaDeclarations(
  clauses: readonly ParsedClause[],
  migrationIndex: number,
  migrationFileName?: string,
): void {
  for (const clause of clauses) {
    if (clause.predicate === 'DefPred') {
      validateDefPredDeclaration(clause, migrationIndex, migrationFileName);
    }

    if (clause.predicate === 'DefCompound') {
      validateDefCompoundDeclaration(clause, migrationIndex, migrationFileName);
    }
  }
}

function validateDefPredDeclaration(
  clause: ParsedClause,
  migrationIndex: number,
  migrationFileName?: string,
): void {
  if (clause.references.length !== 5) {
    throwInvalidSchemaDeclaration(createInvalidSchemaDeclarationInput({
      clause,
      migrationIndex,
      migrationFileName,
      reason: 'DefPred declarations must provide predicate name, subject cardinality, subject domain, object cardinality, and object domain.',
    }));
  }

  if (extractDefPredSchema(clause) !== null) {
    return;
  }

  throwInvalidSchemaDeclaration(createInvalidSchemaDeclarationInput({
    clause,
    migrationIndex,
    migrationFileName,
    reason: 'DefPred declarations must use supported cardinalities and scalar domains.',
  }));
}

function validateDefCompoundDeclaration(
  clause: ParsedClause,
  migrationIndex: number,
  migrationFileName?: string,
): void {
  if (clause.references.length !== 4) {
    throwInvalidSchemaDeclaration(createInvalidSchemaDeclarationInput({
      clause,
      migrationIndex,
      migrationFileName,
      reason: 'DefCompound declarations must provide compound name, field name, field cardinality, and field domain.',
    }));
  }

  if (extractDefCompoundSchemas([clause]).length > 0) {
    return;
  }

  throwInvalidSchemaDeclaration(createInvalidSchemaDeclarationInput({
    clause,
    migrationIndex,
    migrationFileName,
    reason: 'DefCompound declarations must use supported cardinalities and scalar domains.',
  }));
}

function createInvalidSchemaDeclarationInput(input: {
  readonly clause: ParsedClause;
  readonly migrationIndex: number;
  readonly migrationFileName: string | undefined;
  readonly reason: string;
}): {
  readonly clause: ParsedClause;
  readonly migrationIndex: number;
  readonly migrationFileName?: string;
  readonly reason: string;
} {
  return {
    clause: input.clause,
    migrationIndex: input.migrationIndex,
    ...(input.migrationFileName === undefined ? {} : { migrationFileName: input.migrationFileName }),
    reason: input.reason,
  };
}

function throwInvalidSchemaDeclaration(
  input: {
    readonly clause: ParsedClause;
    readonly migrationIndex: number;
    readonly migrationFileName?: string;
    readonly reason: string;
  },
): never {
  const locationPrefix = input.migrationFileName === undefined
    ? `migration #${input.migrationIndex + 1}`
    : `migration ${input.migrationFileName}`;

  throw new DatalogMigrationSchemaError({
    code: 'datalog-migrate.invalid-schema-declaration',
    message: `${locationPrefix} contains an invalid ${input.clause.predicate} declaration. ${input.reason}`,
    details: {
      ...(input.migrationFileName === undefined ? {} : { migrationFileName: input.migrationFileName }),
      migrationIndex: input.migrationIndex,
      predicate: input.clause.predicate,
    },
  });
}

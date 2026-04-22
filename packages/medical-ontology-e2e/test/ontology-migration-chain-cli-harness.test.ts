import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadCommittedOntologyFacts } from './fixtures/committed-ontology-facts-fixture.js';
import {
  cleanupTemporaryOntologyWorkspaces,
  createOntologyMigrationWorkspaceFixture,
  replayCanonicalOntologyMigrationChain,
  runPublicCommitCli,
} from './fixtures/ontology-migration-chain-fixture.js';

const temporaryRoots: string[] = [];

describe('ontology migration chain cli harness', () => {
  afterEach(() => {
    cleanupTemporaryOntologyWorkspaces(temporaryRoots);
  });

  it('builds a fresh committed ontology migration chain through the public datalog-migrate commit CLI', () => {
    const workspaceRoot = createOntologyMigrationWorkspaceFixture(temporaryRoots);

    writeFileSync(
      path.join(workspaceRoot, 'current.dl'),
      'Edge("concept/example-medication", "graph/has_foreign_identifier", "foreign-id/example-source-id").\n',
      'utf8',
    );
    const firstCommit = runPublicCommitCli(workspaceRoot, ['--message', 'foreign id backlink']);

    writeFileSync(
      path.join(workspaceRoot, 'current.dl'),
      'Edge("concept/example-medication", "graph/in_source_graph", "source-graph/example-source").\n',
      'utf8',
    );
    const secondCommit = runPublicCommitCli(workspaceRoot, ['--message', 'source graph backlink']);

    expect(firstCommit.status).toBe(0);
    expect(firstCommit.stderr).toBe('');
    expect(firstCommit.stdout.trim()).toMatch(/^\d{8}\.0001\.foreign-id-backlink\.dl$/u);
    expect(secondCommit.status).toBe(0);
    expect(secondCommit.stderr).toBe('');
    expect(secondCommit.stdout.trim()).toMatch(/^\d{8}\.0002\.source-graph-backlink\.dl$/u);

    const committedFileNames = readdirSync(path.join(workspaceRoot, 'migrations')).sort();
    expect(committedFileNames).toEqual([
      firstCommit.stdout.trim(),
      secondCommit.stdout.trim(),
    ]);

    const facts = loadCommittedOntologyFacts({ workspaceRoot });

    expect(facts.some((fact) => fact.kind === 'vertex' && fact.id === 'concept/example-medication')).toBe(true);
    expect(facts.some((fact) => fact.kind === 'vertex' && fact.id === 'foreign-id/example-source-id')).toBe(true);
    expect(facts.some((fact) => fact.kind === 'vertex' && fact.id === 'source-graph/example-source')).toBe(true);
    expect(
      facts.some(
        (fact) => fact.kind === 'edge'
          && fact.subjectId === 'concept/example-medication'
          && fact.predicateId === 'graph/has_foreign_identifier'
          && fact.objectId === 'foreign-id/example-source-id',
      ),
    ).toBe(true);
    expect(
      facts.some(
        (fact) => fact.kind === 'edge'
          && fact.subjectId === 'concept/example-medication'
          && fact.predicateId === 'graph/in_source_graph'
          && fact.objectId === 'source-graph/example-source',
      ),
    ).toBe(true);
  });

  it('fails chain generation on invalid current.dl input before any downstream ontology fact loading', () => {
    const workspaceRoot = createOntologyMigrationWorkspaceFixture(temporaryRoots);
    writeFileSync(
      path.join(workspaceRoot, 'current.dl'),
      '% migration.previous: none\nEdge("concept/example-medication", "graph/has_foreign_identifier", "foreign-id/example-source-id").\n',
      'utf8',
    );

    const commitResult = runPublicCommitCli(workspaceRoot, ['--message', 'invalid metadata']);

    expect(commitResult.status).not.toBe(0);
    expect(`${commitResult.stdout}${commitResult.stderr}`).toContain(
      'current.dl must not contain committed migration metadata lines.',
    );
    expect(readdirSync(path.join(workspaceRoot, 'migrations'))).toEqual([]);
    expect(() => loadCommittedOntologyFacts({ workspaceRoot })).toThrow(
      'Expected committed ontology migrations to contain at least one Edge fact.',
    );
  });

  it('replays the canonical ontology workflow steps through the public CLI into a fresh workspace', () => {
    const workspaceRoot = createOntologyMigrationWorkspaceFixture(temporaryRoots);

    const committedFileNames = replayCanonicalOntologyMigrationChain(workspaceRoot);
    const facts = loadCommittedOntologyFacts({ workspaceRoot });

    expect(committedFileNames).toHaveLength(4);
    expect(facts.some((fact) => fact.kind === 'vertex' && fact.id === 'medication/metformin')).toBe(true);
    expect(
      facts.some(
        (fact) => fact.kind === 'edge'
          && fact.subjectId === 'condition/type_2_diabetes'
          && fact.predicateId === 'med/has_mapping'
          && fact.objectId === 'mapping/icd10_e11',
      ),
    ).toBe(true);
  });
});

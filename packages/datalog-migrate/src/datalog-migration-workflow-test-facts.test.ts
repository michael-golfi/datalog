import { describe } from 'vitest';

import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';

type WorkflowFact =
  | { kind: 'vertex'; id: string }
  | { kind: 'edge'; subjectId: string; predicateId: string; objectId: string };

/** Load committed workflow facts from a temporary migration workspace for DB application. */
export function loadCommittedWorkflowFacts(workspaceRoot: string): readonly [WorkflowFact, ...WorkflowFact[]] {
  const projectFiles = loadDatalogMigrationProjectFiles({ workspaceRoot });
  const subjectIds = new Set<string>();
  const objectIds = new Set<string>();
  const edges = projectFiles.committedMigrations
    .flatMap((migration) => migration.body.split('\n'))
    .filter((line) => line.startsWith('Edge('))
    .map((line) => {
      const { subjectId, predicateId, objectId } = parseCommittedEdgeLine(line);
      subjectIds.add(subjectId);
      objectIds.add(objectId);
      return {
        kind: 'edge' as const,
        subjectId,
        predicateId,
        objectId,
      };
    });
  const vertices = [...new Set([...subjectIds, ...objectIds])].map((id) => ({ kind: 'vertex' as const, id }));
  const facts = [...vertices, ...edges];

  if (facts.length === 0) {
    throw new Error('Expected committed migrations to produce at least one fact.');
  }

  const [firstFact, ...remainingFacts] = facts;

  if (!firstFact) {
    throw new Error('Expected committed migrations to produce at least one fact.');
  }

  return [firstFact, ...remainingFacts];
}

function parseCommittedEdgeLine(line: string): {
  readonly subjectId: string;
  readonly predicateId: string;
  readonly objectId: string;
} {
  const match = /^Edge\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)\.$/u.exec(line.trim());

  if (!match) {
    throw new Error(`Unsupported committed edge line: ${line}`);
  }

  const subjectId = match[1];
  const predicateId = match[2];
  const objectId = match[3];

  if (subjectId === undefined || predicateId === undefined || objectId === undefined) {
    throw new Error(`Unsupported committed edge line: ${line}`);
  }

  return { subjectId, predicateId, objectId };
}

describe.skip('datalog migration workflow test fact support', () => {});

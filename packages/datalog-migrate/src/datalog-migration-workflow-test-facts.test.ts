import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';

import { describe } from 'vitest';

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
      const match = /^Edge\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)\.$/u.exec(line.trim());
      if (!match) {
        throw new Error(`Unsupported committed edge line: ${line}`);
      }

      const [, subjectId, predicateId, objectId] = match;
      subjectIds.add(subjectId!);
      objectIds.add(objectId!);
      return {
        kind: 'edge' as const,
        subjectId: subjectId!,
        predicateId: predicateId!,
        objectId: objectId!,
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

describe.skip('datalog migration workflow test fact support', () => {});

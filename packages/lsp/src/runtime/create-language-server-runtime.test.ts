import { describe, expect, it } from 'vitest';

import { createLanguageServerRuntime } from './create-language-server-runtime.js';
import { DATALOG_SAMPLE } from '../features/datalog-sample.js';

describe('createLanguageServerRuntime', () => {
  it('returns a parser-backed runtime with migrated feature handlers and a workspace index', () => {
    const runtime = createLanguageServerRuntime();
    const parsed = runtime.parseDocument('person("alice").');
    const completions = runtime.computeCompletions(
      `${DATALOG_SAMPLE}
Cla`,
      { line: 19, character: 3 },
    );

    runtime.workspaceIndex.upsertOpenDocument({
      uri: 'file:///workspace/current.dl',
      source: 'RuntimeIndexed(value).',
    });

    expect(parsed.clauses).toHaveLength(1);
    expect(parsed.clauses[0]?.predicate).toBe('person');
    expect(completions.map((item) => item.label)).toContain('ClassAncestor');
    expect(runtime.computeDiagnostics(DATALOG_SAMPLE)).toHaveLength(0);
    expect(
      runtime.workspaceIndex.getPredicateDefinitions('user-predicate:RuntimeIndexed/1'),
    ).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';

import { DATALOG_SAMPLE } from '../features/datalog-sample.js';
import { createLanguageServerRuntime } from './create-language-server-runtime.js';

describe('createLanguageServerRuntime', () => {
  it('returns a parser-backed runtime with migrated feature handlers', () => {
    const runtime = createLanguageServerRuntime();
    const parsed = runtime.parseDocument('person("alice").');
    const completions = runtime.computeCompletions(`${DATALOG_SAMPLE}\nCla`, { line: 19, character: 3 });

    expect(parsed.clauses).toHaveLength(1);
    expect(parsed.clauses[0]?.predicate).toBe('person');
    expect(completions.map((item) => item.label)).toContain('ClassAncestor');
    expect(runtime.computeDiagnostics(DATALOG_SAMPLE)).toHaveLength(0);
  });
});

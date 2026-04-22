import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { createDatalogPlugin } from './plugin.js';

function createLintConfig(plugin: ReturnType<typeof createDatalogPlugin>['plugin']): ESLint.Options['overrideConfig'] {
  return [
    {
      files: ['**/*.dl'],
      plugins: { datalog: plugin },
      processor: 'datalog/datalog',
    },
    {
      files: ['**/*.dl.__datalog__'],
      plugins: { datalog: plugin },
      rules: {
        'datalog/require-statement-termination': 'error',
        'datalog/no-duplicate-predicate-schemas': 'error',
        'datalog/no-unterminated-string': 'error',
      },
    },
  ];
}

async function lintDatalog(code: string): Promise<ESLint.LintResult[]> {
  const { plugin } = createDatalogPlugin();
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: createLintConfig(plugin),
  });

  return eslint.lintText(code, { filePath: 'fixture.dl' });
}

function expectLintResult(result: ESLint.LintResult | undefined, message: string): ESLint.LintResult {
  expect(result).toBeDefined();
  if (!result) {
    throw new Error(message);
  }

  return result;
}

describe('datalog ESLint integration', () => {
  it('reports unfinished statements', async () => {
    const [result] = await lintDatalog('Edge("a", "b", "c")');
    const lintResult = expectLintResult(result, 'Expected ESLint result for unfinished statement fixture.');

    expect(lintResult.messages.map((message) => message.ruleId)).toContain('datalog/require-statement-termination');
  });

  it('reports duplicate DefPred declarations', async () => {
    const [result] = await lintDatalog([
      'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
      'DefPred("graph/likes", "1", "graph/node", "0", "graph/node").',
    ].join('\n'));
    const lintResult = expectLintResult(result, 'Expected ESLint result for duplicate schema fixture.');

    expect(lintResult.messages.map((message) => message.ruleId)).toContain('datalog/no-duplicate-predicate-schemas');
  });

  it('reports unterminated strings', async () => {
    const [result] = await lintDatalog('Edge("a", "graph/likes", "unterminated).');
    const lintResult = expectLintResult(result, 'Expected ESLint result for unterminated string fixture.');

    expect(lintResult.messages.map((message) => message.ruleId)).toContain('datalog/no-unterminated-string');
  });
});

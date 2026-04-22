import type { Rule } from 'eslint';

import { extractDatalogSource, toVirtualLoc } from './datalog-source.js';

export const datalogRequireStatementTermination: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require top-level Datalog statements to end with a period.',
    },
    schema: [],
    messages: {
      missingPeriod: 'Datalog statement must end with a period.',
    },
  },
  create(context) {
    const source = extractDatalogSource(context.sourceCode.getText());

    return {
      Program() {
        let statementStart: number | null = null;
        let currentOffset = 0;

        for (const line of source.split('\n')) {
          const lineWithBreak = `${line}\n`;
          const trimmed = line.trim();

          if (statementStart === null && trimmed.length > 0 && !trimmed.startsWith('%')) {
            statementStart = currentOffset;
          }

          if (statementStart !== null && trimmed.endsWith('.')) {
            statementStart = null;
          }

          currentOffset += lineWithBreak.length;
        }

        if (statementStart !== null) {
          context.report({
            loc: toVirtualLoc(source, statementStart),
            messageId: 'missingPeriod',
          });
        }
      },
    };
  },
};

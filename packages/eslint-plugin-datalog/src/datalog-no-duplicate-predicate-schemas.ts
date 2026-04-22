import type { Rule } from 'eslint';

import { extractDatalogSource, toVirtualLoc } from './datalog-source.js';

const DEF_PRED_PATTERN = /DefPred\(\s*"([^"]+)"/gu;

export const datalogNoDuplicatePredicateSchemas: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow duplicate DefPred declarations for the same predicate id.',
    },
    schema: [],
    messages: {
      duplicateSchema: 'Duplicate DefPred for {{predicateId}}.',
    },
  },
  create(context) {
    const source = extractDatalogSource(context.sourceCode.getText());

    return {
      Program() {
        const seen = new Set<string>();

        for (const match of source.matchAll(DEF_PRED_PATTERN)) {
          const predicateId = match[1];
          const offset = match.index;

          if (predicateId === undefined) {
            continue;
          }

          if (seen.has(predicateId)) {
            context.report({
              loc: toVirtualLoc(source, offset, offset + match[0].length),
              messageId: 'duplicateSchema',
              data: { predicateId },
            });
          }

          seen.add(predicateId);
        }
      },
    };
  },
};

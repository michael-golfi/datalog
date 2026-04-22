import type { Rule } from 'eslint';

import { extractDatalogSource, toVirtualLoc } from './datalog-source.js';

export const datalogNoUnterminatedString: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unterminated quoted strings in Datalog files.',
    },
    schema: [],
    messages: {
      unterminatedString: 'Detected an unterminated string literal.',
    },
  },
  create(context) {
    const source = extractDatalogSource(context.sourceCode.getText());

    return {
      Program() {
        let inString = false;
        let stringStart = 0;

        for (let index = 0; index < source.length; index += 1) {
          const character = source[index] ?? '';
          const isUnescapedQuote = character === '"' && source[index - 1] !== '\\';

          if (!isUnescapedQuote) {
            continue;
          }

          if (!inString) {
            stringStart = index;
          }

          inString = !inString;
        }

        if (inString) {
          context.report({
            loc: toVirtualLoc(source, stringStart),
            messageId: 'unterminatedString',
          });
        }
      },
    };
  },
};

import { getJsxAttributeName } from '../shared/ast.js';
import { isCssVariablesOnlyStyle } from '../shared/style-ast.js';

import type { Rule } from 'eslint';

export const noInlineStyles: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow inline styles except CSS custom property bridges into design-system primitives.',
    },
    schema: [],
    messages: {
      inlineStyle:
        'Do not use inline style objects in product UI. Use design tokens, variants, or CSS custom properties only.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node: unknown) {
        if (getJsxAttributeName(node as never) !== 'style') {
          return;
        }

        if (isCssVariablesOnlyStyle(node as never)) {
          return;
        }

        context.report({
          node: node as never,
          messageId: 'inlineStyle',
        });
      },
    };
  },
};

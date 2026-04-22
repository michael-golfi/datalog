import type { Rule } from 'eslint';

import { getJsxName, hasJsxAttribute } from '../shared/ast.js';

interface JsxOpeningElementLike {
  name: unknown;
  attributes: unknown[];
}

export const requireButtonType: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explicit type on raw button elements.',
    },
    schema: [],
    messages: {
      missingButtonType:
        'Raw <button> must declare type="button", type="submit", or type="reset" to avoid accidental form submission.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node: unknown) {
        const openingElement = node as JsxOpeningElementLike;
        const elementName = getJsxName(openingElement.name as never);

        if (elementName !== 'button') {
          return;
        }

        if (hasJsxAttribute(openingElement as never, 'type')) {
          return;
        }

        context.report({
          node: node as never,
          messageId: 'missingButtonType',
        });
      },
    };
  },
};

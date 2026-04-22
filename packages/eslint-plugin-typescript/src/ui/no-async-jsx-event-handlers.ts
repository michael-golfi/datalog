import type { Rule } from 'eslint';

import { getJsxAttributeName, getJsxExpression, isAsyncFunctionExpression } from '../shared/ast.js';

export const noAsyncJsxEventHandlers: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow inline async JSX event handlers; mutations should flow through stateful action primitives.',
    },
    schema: [],
    messages: {
      asyncEventHandler:
        'Do not use inline async JSX event handlers. Route mutations through an action/state primitive that exposes pending, success, and error states.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node: unknown) {
        const attributeName = getJsxAttributeName(node as never);

        if (!attributeName || !/^on[A-Z]/u.test(attributeName)) {
          return;
        }

        const expression = getJsxExpression(node as never);

        if (!isAsyncFunctionExpression(expression as never)) {
          return;
        }

        context.report({
          node: node as never,
          messageId: 'asyncEventHandler',
        });
      },
    };
  },
};

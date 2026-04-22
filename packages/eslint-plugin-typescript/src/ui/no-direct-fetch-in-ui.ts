import type { Rule } from 'eslint';

interface CallExpressionLike {
  callee?: {
    type?: string;
    name?: string;
  };
}

export const noDirectFetchInUi: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct fetch calls from UI code; use the typed application API/client layer.',
    },
    schema: [],
    messages: {
      directFetch:
        'Do not call fetch directly from UI code. Use a typed client, loader, action, or data service instead.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callExpression = node as CallExpressionLike;

        if (callExpression.callee?.type !== 'Identifier' || callExpression.callee.name !== 'fetch') {
          return;
        }

        context.report({
          node,
          messageId: 'directFetch',
        });
      },
    };
  },
};

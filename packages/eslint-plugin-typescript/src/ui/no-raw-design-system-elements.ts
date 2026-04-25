import { getJsxName } from '../shared/ast.js';

import type { Rule } from 'eslint';

interface RuleOption {
  elements?: Record<string, string>;
}

export const noRawDesignSystemElements: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw platform elements that should be expressed through design-system primitives.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          elements: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawElement:
        'Do not render raw <{{element}}> in product UI. Use the design-system primitive: {{preferred}}.',
    },
  },
  create(context) {
    const option = context.options[0] as RuleOption | undefined;
    const elementMap = option?.elements ?? {};
    const restrictedElements = new Set(Object.keys(elementMap));

    return {
      JSXOpeningElement(node: unknown) {
        const elementName = getJsxName((node as { name: unknown }).name as never);

        if (!elementName || !restrictedElements.has(elementName)) {
          return;
        }

        context.report({
          node: node as never,
          messageId: 'rawElement',
          data: {
            element: elementName,
            preferred: elementMap[elementName],
          },
        });
      },
    };
  },
};

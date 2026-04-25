import { reportHardcodedDesignValues } from '../shared/style-ast.js';

import type { Rule } from 'eslint';

interface LiteralLike {
  value: unknown;
}

interface TemplateElementLike {
  value: {
    cooked?: string | null;
  };
}

export const noHardcodedDesignValues: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded colors, spacing units, and Tailwind arbitrary values in product UI.',
    },
    schema: [],
    messages: {
      hardcodedDesignValue:
        'Hardcoded visual value detected. Use a design token, component variant, or named semantic size/color.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        reportHardcodedDesignValues(context, node, (node as LiteralLike).value);
      },
      TemplateElement(node) {
        reportHardcodedDesignValues(context, node, (node as TemplateElementLike).value.cooked);
      },
    };
  },
};

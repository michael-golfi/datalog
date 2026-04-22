import type { Rule } from 'eslint';

import {
  findJsxAttribute,
  getJsxName,
  getStaticAttributeValue,
} from '../shared/ast.js';

interface RuleOption {
  shellComponents?: string[];
  h1Components?: string[];
}

interface JsxOpeningElementLike {
  name: unknown;
  attributes: unknown[];
}

interface PageStructureState {
  hasShell: boolean;
  hasH1: boolean;
}

interface MissingPageStructureReport {
  context: Rule.RuleContext;
  node: unknown;
  state: PageStructureState;
  shellComponents: Set<string>;
}

function matchesHeadingLevel(openingElement: JsxOpeningElementLike): boolean {
  const asValue = getStaticAttributeValue(findJsxAttribute(openingElement as never, 'as'));
  const levelValue = getStaticAttributeValue(findJsxAttribute(openingElement as never, 'level'));
  return asValue === 'h1' || levelValue === 1 || levelValue === '1';
}

function reportMissingPageStructure({ context, node, state, shellComponents }: MissingPageStructureReport): void {
  if (!state.hasShell) {
    context.report({
      node: node as never,
      messageId: 'missingShell',
      data: {
        components:
          shellComponents.size === 0
            ? 'a configured shell component'
            : Array.from(shellComponents).join(', '),
      },
    });
  }

  if (!state.hasH1) {
    context.report({
      node: node as never,
      messageId: 'missingH1',
    });
  }
}

export const requirePageStructure: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require route files to render through an approved shell and expose a top-level page heading.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          shellComponents: {
            type: 'array',
            items: { type: 'string' },
          },
          h1Components: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingShell: 'Route files must render through an approved page shell. Use one of: {{components}}.',
      missingH1: 'Route files must expose a clear page heading. Use <h1> or a configured heading primitive.',
    },
  },
  create(context) {
    const option = context.options[0] as RuleOption | undefined;
    const shellComponents = new Set(option?.shellComponents ?? []);
    const h1Components = new Set(option?.h1Components ?? []);
    const state: PageStructureState = {
      hasShell: false,
      hasH1: false,
    };

    return {
      JSXOpeningElement(node: unknown) {
        const openingElement = node as JsxOpeningElementLike;
        const elementName = getJsxName(openingElement.name as never);

        if (!elementName) {
          return;
        }

        if (shellComponents.has(elementName)) {
          state.hasShell = true;
        }

        if (elementName === 'h1' || h1Components.has(elementName)) {
          state.hasH1 = true;
          return;
        }

        if (matchesHeadingLevel(openingElement)) {
          state.hasH1 = true;
        }
      },
      'Program:exit'(node: unknown) {
        reportMissingPageStructure({ context, node, state, shellComponents });
      },
    };
  },
};

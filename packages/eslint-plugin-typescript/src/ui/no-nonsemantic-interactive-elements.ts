import type { Rule } from 'eslint';

import {
  findJsxAttribute,
  getJsxAttributeName,
  getJsxName,
  getStaticAttributeValue,
} from '../shared/ast.js';

interface JsxOpeningElementLike {
  name: unknown;
  attributes: unknown[];
}

const activationHandlers = new Set([
  'onClick',
  'onDoubleClick',
  'onKeyDown',
  'onKeyUp',
  'onMouseDown',
  'onMouseUp',
  'onPointerDown',
  'onPointerUp',
  'onTouchStart',
  'onTouchEnd',
]);

const interactiveRoles = new Set([
  'button',
  'checkbox',
  'link',
  'menuitem',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
]);

const nonsemanticElements = new Set(['div', 'span', 'section', 'article', 'li']);

function hasActivationHandler(attributes: unknown[]): boolean {
  return attributes.some((attribute) => {
    const attributeName = getJsxAttributeName(attribute as never);
    return attributeName !== null && activationHandlers.has(attributeName);
  });
}

export const noNonsemanticInteractiveElements: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow click/keyboard handlers and interactive roles on non-semantic div/span elements.',
    },
    schema: [],
    messages: {
      nonsemanticInteractive:
        'Do not attach interactive behavior to <{{element}}>. Use a semantic element or a design-system primitive with built-in accessibility.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node: unknown) {
        const openingElement = node as JsxOpeningElementLike;
        const elementName = getJsxName(openingElement.name as never);

        if (!elementName || !nonsemanticElements.has(elementName)) {
          return;
        }

        const hasInteractiveHandler = hasActivationHandler(openingElement.attributes);
        const role = getStaticAttributeValue(findJsxAttribute(openingElement as never, 'role'));
        const hasInteractiveRole = typeof role === 'string' && interactiveRoles.has(role);

        if (!hasInteractiveHandler && !hasInteractiveRole) {
          return;
        }

        context.report({
          node: node as never,
          messageId: 'nonsemanticInteractive',
          data: { element: elementName },
        });
      },
    };
  },
};

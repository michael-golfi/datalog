import type { Rule } from 'eslint';

interface TemplateQuasiLike {
  value?: { cooked?: string | null };
}

interface LiteralPropertyKeyLike {
  type: 'Literal';
  value: unknown;
}

interface IdentifierPropertyKeyLike {
  type: 'Identifier';
  name: string;
}

interface TemplateLiteralPropertyKeyLike {
  type: 'TemplateLiteral';
  expressions: unknown[];
  quasis: TemplateQuasiLike[];
}

type PropertyKeyLike = LiteralPropertyKeyLike | IdentifierPropertyKeyLike | TemplateLiteralPropertyKeyLike | null | undefined;

interface ObjectPropertyLike {
  type: 'Property';
  key: PropertyKeyLike;
}

interface OtherObjectPropertyLike {
  type: string;
}

interface StyleObjectExpressionLike {
  type: 'ObjectExpression';
  properties: Array<ObjectPropertyLike | OtherObjectPropertyLike>;
}

interface StyleAttributeValueLike {
  type: 'JSXExpressionContainer';
  expression?: StyleObjectExpressionLike | null;
}

export interface StyleAttributeLike {
  value?: StyleAttributeValueLike | null;
}

export const hardcodedDesignValuePattern = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(|(?:^|[^\w-])-?\d+(?:\.\d+)?(?:px|rem|em|vh|vw)\b|\[[^\]]*(?:px|rem|em|vh|vw|#[0-9a-fA-F]{3,8}|rgb|hsl)[^\]]*\]/u;

function getTemplateLiteralPropertyName(key: TemplateLiteralPropertyKeyLike): string | null {
  if (key.expressions.length > 0) {
    return null;
  }

  return key.quasis[0]?.value?.cooked ?? null;
}

function isObjectPropertyLike(property: ObjectPropertyLike | OtherObjectPropertyLike): property is ObjectPropertyLike {
  return property.type === 'Property';
}

function getCssVariablePropertyName(key: PropertyKeyLike): string | null {
  if (!key) {
    return null;
  }

  switch (key.type) {
    case 'Literal':
      return typeof key.value === 'string' ? key.value : null;
    case 'Identifier':
      return key.name;
    case 'TemplateLiteral':
      return getTemplateLiteralPropertyName(key);
    default:
      return null;
  }
}

/** Check whether a style object key is a CSS custom property. */
export function isCssVariablePropertyKey(key: PropertyKeyLike): boolean {
  return getCssVariablePropertyName(key)?.startsWith('--') ?? false;
}

/** Check whether a JSX style attribute only bridges CSS custom properties. */
export function isCssVariablesOnlyStyle(attribute: StyleAttributeLike): boolean {
  const value = attribute.value;

  if (value?.type !== 'JSXExpressionContainer') {
    return false;
  }

  const expression = value.expression;

  if (expression?.type !== 'ObjectExpression') {
    return false;
  }

  return expression.properties.every((property) => {
    if (!isObjectPropertyLike(property)) {
      return false;
    }

    return isCssVariablePropertyKey(property.key);
  });
}

/** Report hardcoded design values that should be expressed semantically. */
export function reportHardcodedDesignValues(
  context: Rule.RuleContext,
  node: unknown,
  value: unknown,
): void {
  if (typeof value !== 'string') {
    return;
  }

  if (!hardcodedDesignValuePattern.test(value)) {
    return;
  }

  context.report({
    node: node as never,
    messageId: 'hardcodedDesignValue',
  });
}

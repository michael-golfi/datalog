interface JsxIdentifierLike {
  type: 'JSXIdentifier';
  name: string;
}

interface JsxMemberExpressionLike {
  type: 'JSXMemberExpression';
  object: JsxNameLike;
  property: JsxNameLike;
}

interface JsxNamespacedNameLike {
  type: 'JSXNamespacedName';
  namespace: { name: string };
  name: { name: string };
}

type JsxNameLike = JsxIdentifierLike | JsxMemberExpressionLike | JsxNamespacedNameLike | null | undefined;

interface JsxLiteralLike {
  type: 'Literal';
  value: unknown;
}

interface JsxTemplateQuasiLike {
  value?: { cooked?: string | null };
}

interface JsxTemplateLiteralLike {
  type: 'TemplateLiteral';
  expressions: unknown[];
  quasis: JsxTemplateQuasiLike[];
}

interface JsxExpressionLike {
  type: string;
  [key: string]: unknown;
}

interface JsxExpressionContainerLike {
  type: 'JSXExpressionContainer';
  expression: JsxLiteralLike | JsxTemplateLiteralLike | JsxExpressionLike;
}

interface JsxAttributeLike {
  type: 'JSXAttribute';
  name: JsxIdentifierLike | JsxNamespacedNameLike;
  value?: JsxLiteralLike | JsxExpressionContainerLike | null;
}

interface JsxSpreadAttributeLike {
  type: 'JSXSpreadAttribute';
}

interface JsxOpeningElementLike {
  attributes: Array<JsxAttributeLike | JsxSpreadAttributeLike>;
}

type AsyncFunctionExpressionLike = {
  type?: string;
  async?: boolean;
} | null | undefined;

type JsxExpressionAttributeLike = {
  value?: {
    type: 'JSXExpressionContainer';
    expression: unknown;
  } | null;
} | null | undefined;

export const genericBasenames = new Set(['common', 'helpers', 'manager', 'misc', 'processor', 'utils']);

/** Read a JSX tag or member expression name as text. */
export function getJsxName(nameNode: JsxNameLike): string | null {
  if (!nameNode) {
    return null;
  }

  if (nameNode.type === 'JSXIdentifier') {
    return nameNode.name;
  }

  if (nameNode.type === 'JSXMemberExpression') {
    const objectName = getJsxName(nameNode.object);
    const propertyName = getJsxName(nameNode.property);
    return objectName && propertyName ? `${objectName}.${propertyName}` : null;
  }

  return `${nameNode.namespace.name}:${nameNode.name.name}`;
}

/** Read a JSX attribute name when present. */
export function getJsxAttributeName(attribute: JsxAttributeLike | JsxSpreadAttributeLike | null | undefined): string | null {
  if (attribute?.type !== 'JSXAttribute') {
    return null;
  }

  if (attribute.name.type === 'JSXIdentifier') {
    return attribute.name.name;
  }

  return `${attribute.name.namespace.name}:${attribute.name.name.name}`;
}

/** Find a JSX attribute by name on an opening element. */
export function findJsxAttribute(
  openingElement: JsxOpeningElementLike,
  attributeName: string,
): JsxAttributeLike | undefined {
  return openingElement.attributes.find((attribute) => getJsxAttributeName(attribute) === attributeName) as
    | JsxAttributeLike
    | undefined;
}

/** Check whether a JSX opening element declares an attribute. */
export function hasJsxAttribute(openingElement: JsxOpeningElementLike, attributeName: string): boolean {
  return Boolean(findJsxAttribute(openingElement, attributeName));
}

function getTemplateLiteralValue(expression: JsxTemplateLiteralLike): string | null {
  if (expression.expressions.length > 0) {
    return null;
  }

  return expression.quasis[0]?.value?.cooked ?? null;
}

function getExpressionContainerValue(value: JsxExpressionContainerLike): unknown {
  const expression = value.expression;

  if (expression.type === 'Literal') {
    return expression.value;
  }

  if (expression.type === 'TemplateLiteral') {
    return getTemplateLiteralValue(expression as JsxTemplateLiteralLike);
  }

  return null;
}

/** Read the static value of a JSX attribute when one exists. */
export function getStaticAttributeValue(attribute: JsxAttributeLike | undefined | null): unknown {
  if (!attribute) {
    return null;
  }

  if (!attribute.value) {
    return true;
  }

  if (attribute.value.type === 'Literal') {
    return attribute.value.value;
  }

  return getExpressionContainerValue(attribute.value);
}

/** Check whether a JSX expression is an inline async function. */
export function isAsyncFunctionExpression(node: AsyncFunctionExpressionLike): boolean {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression'
  ) && node.async === true;
}

/** Read the expression inside a JSX expression container attribute. */
export function getJsxExpression(attribute: JsxExpressionAttributeLike): unknown | null {
  if (attribute?.value?.type !== 'JSXExpressionContainer') {
    return null;
  }

  return attribute.value.expression;
}

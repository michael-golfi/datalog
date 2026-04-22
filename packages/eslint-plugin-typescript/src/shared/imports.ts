import type { Rule } from 'eslint';

interface LiteralLike {
  type: 'Literal';
  value: unknown;
}

export interface ImportLikeNode {
  type: string;
  source?: unknown;
  callee?: unknown;
  arguments?: unknown[];
  importKind?: string;
  specifiers?: unknown[];
}

interface ImportSpecifierLike {
  importKind?: string;
}

interface RequireCallLike {
  type: 'CallExpression';
  callee: { type: 'Identifier'; name: string };
  arguments: unknown[];
}

function hasStaticDeclarationSource(node: ImportLikeNode): boolean {
  return (
    node.type === 'ImportDeclaration' ||
    node.type === 'ExportNamedDeclaration' ||
    node.type === 'ExportAllDeclaration'
  );
}

function isLiteralString(value: unknown): value is LiteralLike & { value: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'Literal' &&
    'value' in value &&
    typeof value.value === 'string'
  );
}

function isRequireCall(node: ImportLikeNode): node is RequireCallLike {
  return (
    node.type === 'CallExpression' &&
    typeof node.callee === 'object' &&
    node.callee !== null &&
    'type' in node.callee &&
    node.callee.type === 'Identifier' &&
    'name' in node.callee &&
    node.callee.name === 'require' &&
    Array.isArray(node.arguments)
  );
}

/** Read a static source string from import-like syntax. */
export function getStaticSourceValue(node: ImportLikeNode): string | null {
  if (hasStaticDeclarationSource(node) && isLiteralString(node.source)) {
    return node.source.value;
  }

  if (node.type === 'ImportExpression' && isLiteralString(node.source)) {
    return node.source.value;
  }

  if (isRequireCall(node) && isLiteralString(node.arguments[0])) {
    return node.arguments[0].value;
  }

  return null;
}

/** Return the source sub-node to report for an import-like AST node. */
export function getImportSourceReportNode(node: ImportLikeNode): unknown {
  if ('source' in node && node.source) {
    return node.source;
  }

  if (node.type === 'CallExpression' && Array.isArray(node.arguments) && node.arguments[0]) {
    return node.arguments[0];
  }

  return node;
}

/** Check whether an import-like edge is type-only. */
export function isTypeOnlyImportLike(node: ImportLikeNode): boolean {
  if (node.type !== 'ImportDeclaration') {
    return false;
  }

  if (node.importKind === 'type') {
    return true;
  }

  if (!Array.isArray(node.specifiers) || node.specifiers.length === 0) {
    return false;
  }

  return node.specifiers.every(
    (specifier) =>
      typeof specifier === 'object' &&
      specifier !== null &&
      'importKind' in specifier &&
      (specifier as ImportSpecifierLike).importKind === 'type',
  );
}

/** Create visitors for all import-like syntax forms. */
export function createImportLikeVisitors(checkNode: (node: ImportLikeNode) => void): Rule.RuleListener {
  return {
    ImportDeclaration: checkNode,
    ExportNamedDeclaration: checkNode,
    ExportAllDeclaration: checkNode,
    ImportExpression: checkNode,
    CallExpression: checkNode,
  };
}

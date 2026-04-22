import type { Rule } from 'eslint';

interface BooleanTypeAnnotationLike {
  typeAnnotation?: {
    type?: string;
  } | null;
}

export type BooleanTypeAnnotation = BooleanTypeAnnotationLike | null | undefined;

export type FunctionLikeNode = Rule.Node & {
  type: 'FunctionDeclaration' | 'FunctionExpression' | 'ArrowFunctionExpression';
  params: Rule.Node[];
  returnType?: Rule.Node | null;
};

interface FunctionInitializerLike {
  type?: string;
  params?: Rule.Node[];
  returnType?: Rule.Node | null;
}

interface VariableDeclaratorLike {
  init?: FunctionInitializerLike | null;
}

interface ExportDeclarationLike {
  type?: string;
  returnType?: Rule.Node | null;
  declarations?: VariableDeclaratorLike[];
}

export interface ExportNodeLike {
  declaration?: ExportDeclarationLike | null;
}

function getExportDeclaration(exportNode: ExportNodeLike): ExportDeclarationLike | null {
  return exportNode.declaration ?? null;
}

function isFunctionInitializer(initializer: FunctionInitializerLike | null | undefined): initializer is FunctionLikeNode {
  return initializer?.type === 'ArrowFunctionExpression' || initializer?.type === 'FunctionExpression';
}

function getFunctionInitializer(declaration: ExportDeclarationLike): FunctionLikeNode | null {
  if (declaration.type === 'FunctionDeclaration') {
    return declaration as FunctionLikeNode;
  }

  if (declaration.type !== 'VariableDeclaration') {
    return null;
  }

  for (const declarator of declaration.declarations ?? []) {
    if (isFunctionInitializer(declarator.init)) {
      return declarator.init;
    }
  }

  return null;
}

/** Check whether a type annotation node represents `boolean`. */
export function isBooleanTypeAnnotation(typeAnnotation: BooleanTypeAnnotation): boolean {
  return typeAnnotation?.typeAnnotation?.type === 'TSBooleanKeyword';
}

/** Find the function node from an exported declaration. */
export function getExportedFunctionNode(exportNode: ExportNodeLike): FunctionLikeNode | null {
  const declaration = getExportDeclaration(exportNode);

  if (!declaration) {
    return null;
  }

  return getFunctionInitializer(declaration);
}

/** Read the explicit return type from an exported function declaration. */
export function getExportedFunctionReturnType(exportNode: ExportNodeLike): unknown | null {
  const declaration = getExportDeclaration(exportNode);

  if (!declaration) {
    return null;
  }

  return getFunctionInitializer(declaration)?.returnType ?? null;
}

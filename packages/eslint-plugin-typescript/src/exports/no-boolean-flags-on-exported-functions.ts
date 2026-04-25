import { getExportedFunctionNode, isBooleanTypeAnnotation } from '../shared/export-ast.js';

import type { Rule } from 'eslint';

interface IdentifierParameter {
  type?: string;
  typeAnnotation?: {
    typeAnnotation?: {
      type?: string;
    } | null;
  } | null;
}

function reportBooleanFlagParameters(
  context: Rule.RuleContext,
  parameters: readonly unknown[],
): void {
  for (const parameter of parameters) {
    const identifier = parameter as IdentifierParameter;

    if (identifier.type !== 'Identifier' || !isBooleanTypeAnnotation(identifier.typeAnnotation)) {
      continue;
    }

    context.report({
      node: parameter as never,
      messageId: 'booleanFlag',
    });
  }
}

export const noBooleanFlagsOnExportedFunctions: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow boolean flag parameters on exported functions.',
    },
    schema: [],
    messages: {
      booleanFlag:
        'Exported functions must not use boolean flag parameters. Split the behavior or use a parameter object with a domain-specific mode.',
    },
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const functionNode = getExportedFunctionNode(node as never);

        if (!functionNode) {
          return;
        }

        reportBooleanFlagParameters(context, functionNode.params);
      },
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration;

        if (
          declaration.type !== 'FunctionDeclaration' &&
          declaration.type !== 'FunctionExpression'
        ) {
          return;
        }

        reportBooleanFlagParameters(context, declaration.params);
      },
    };
  },
};

import type { Rule } from 'eslint';

import { getExportedFunctionNode, isBooleanTypeAnnotation } from '../shared/export-ast.js';

interface IdentifierParameter {
  type?: string;
  typeAnnotation?: {
    typeAnnotation?: {
      type?: string;
    } | null;
  } | null;
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

        for (const parameter of functionNode.params) {
          const identifier = parameter as IdentifierParameter;

          if (identifier.type === 'Identifier' && isBooleanTypeAnnotation(identifier.typeAnnotation)) {
            context.report({
              node: parameter,
              messageId: 'booleanFlag',
            });
          }
        }
      },
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration;

        if (declaration.type !== 'FunctionDeclaration' && declaration.type !== 'FunctionExpression') {
          return;
        }

        for (const parameter of declaration.params) {
          const identifier = parameter as IdentifierParameter;

          if (identifier.type === 'Identifier' && isBooleanTypeAnnotation(identifier.typeAnnotation)) {
            context.report({
              node: parameter,
              messageId: 'booleanFlag',
            });
          }
        }
      },
    };
  },
};

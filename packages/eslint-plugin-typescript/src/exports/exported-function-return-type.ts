import { getExportedFunctionNode, getExportedFunctionReturnType } from '../shared/export-ast.js';

import type { Rule } from 'eslint';

interface DefaultExportedFunctionNode {
  type: 'FunctionDeclaration' | 'FunctionExpression';
  returnType?: Rule.Node | null;
}

export const exportedFunctionReturnType: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explicit return types on exported functions.',
    },
    schema: [],
    messages: {
      missingReturnType: 'Exported functions must declare an explicit return type.',
    },
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const functionNode = getExportedFunctionNode(node as never);

        if (!functionNode) {
          return;
        }

        if (getExportedFunctionReturnType(node as never)) {
          return;
        }

        context.report({
          node: functionNode,
          messageId: 'missingReturnType',
        });
      },
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration as DefaultExportedFunctionNode | undefined;

        if (
          declaration?.type !== 'FunctionDeclaration' &&
          declaration?.type !== 'FunctionExpression'
        ) {
          return;
        }

        if (declaration.returnType) {
          return;
        }

        context.report({
          node: declaration,
          messageId: 'missingReturnType',
        });
      },
    };
  },
};

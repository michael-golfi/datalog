import type { Rule } from 'eslint';

interface VariableDeclarationLike {
  parent: { type: string };
  kind: string;
  declare?: boolean;
}

export const noTopLevelMutableState: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow top-level let/var state in runtime modules to preserve stateless process behavior.',
    },
    schema: [],
    messages: {
      topLevelMutableState:
        'Do not keep mutable process state at module scope. Use request context, durable storage, dependency injection, or an explicitly reviewed cache primitive.',
    },
  },
  create(context) {
    return {
      VariableDeclaration(node) {
        const declaration = node as VariableDeclarationLike;

        if (declaration.parent.type !== 'Program' || declaration.kind === 'const' || declaration.declare) {
          return;
        }

        context.report({
          node,
          messageId: 'topLevelMutableState',
        });
      },
    };
  },
};

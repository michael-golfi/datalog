import type { Rule } from 'eslint';

interface MemberExpressionLike {
  type?: string;
  object: IdentifierObjectLike | MetaPropertyObjectLike;
  computed: boolean;
  property: {
    type?: string;
    name: string;
  };
}

interface IdentifierObjectLike {
  type?: string;
  name: string;
}

interface MetaPropertyObjectLike {
  type?: string;
  meta: { name: string };
  property: { name: string };
}

function isIdentifierObject(value: MemberExpressionLike['object']): value is IdentifierObjectLike {
  return value.type === 'Identifier';
}

function isMetaPropertyObject(value: MemberExpressionLike['object']): value is MetaPropertyObjectLike {
  return value.type === 'MetaProperty';
}

export const noAmbientEnvAccess: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct reads from ambient environment globals outside validated config adapters.',
    },
    schema: [],
    messages: {
      ambientEnv:
        'Read deploy configuration through a validated config adapter, not directly from process.env or import.meta.env.',
    },
  },
  create(context) {
    function isProcessEnvMember(node: MemberExpressionLike): boolean {
      return (
        node.type === 'MemberExpression' &&
        isIdentifierObject(node.object) &&
        node.object.name === 'process' &&
        !node.computed &&
        node.property.type === 'Identifier' &&
        node.property.name === 'env'
      );
    }

    function isImportMetaEnvMember(node: MemberExpressionLike): boolean {
      return (
        node.type === 'MemberExpression' &&
        isMetaPropertyObject(node.object) &&
        node.object.meta.name === 'import' &&
        node.object.property.name === 'meta' &&
        !node.computed &&
        node.property.type === 'Identifier' &&
        node.property.name === 'env'
      );
    }

    return {
      MemberExpression(node) {
        const memberExpression = node as MemberExpressionLike;

        if (!isProcessEnvMember(memberExpression) && !isImportMetaEnvMember(memberExpression)) {
          return;
        }

        context.report({
          node,
          messageId: 'ambientEnv',
        });
      },
    };
  },
};

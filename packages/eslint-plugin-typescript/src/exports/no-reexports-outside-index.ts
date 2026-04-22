import path from 'node:path';

import type { Rule } from 'eslint';

interface ExportNamedDeclarationLike {
  source?: unknown;
}

export const noReexportsOutsideIndex: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow re-exports outside index files.',
    },
    schema: [],
    messages: {
      nonIndexReexport:
        'Only index.ts barrel files may re-export. Move this re-export to the nearest surface file or import the dependency directly.',
    },
  },
  create(context) {
    const filename = context.getFilename();

    if (filename === '<input>') {
      return {};
    }

    const isIndexFile = path.basename(filename, path.extname(filename)) === 'index';

    if (isIndexFile) {
      return {};
    }

    return {
      ExportAllDeclaration(node) {
        context.report({
          node,
          messageId: 'nonIndexReexport',
        });
      },
      ExportNamedDeclaration(node) {
        if (!(node as ExportNamedDeclarationLike).source) {
          return;
        }

        context.report({
          node,
          messageId: 'nonIndexReexport',
        });
      },
    };
  },
};

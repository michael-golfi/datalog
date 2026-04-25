import path from 'node:path';

import { genericBasenames } from '../shared/ast.js';

import type { Rule } from 'eslint';

export const noGenericFilenames: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow generic dumping-ground filenames.',
    },
    schema: [],
    messages: {
      genericFilename:
        'Generic filename "{{name}}" is forbidden. Use a domain-qualified or purpose-specific name instead.',
    },
  },
  create(context) {
    const filename = context.getFilename();

    if (filename === '<input>') {
      return {};
    }

    const basename = path.basename(filename, path.extname(filename));

    if (!genericBasenames.has(basename)) {
      return {};
    }

    return {
      Program(node) {
        context.report({
          node,
          messageId: 'genericFilename',
          data: { name: basename },
        });
      },
    };
  },
};

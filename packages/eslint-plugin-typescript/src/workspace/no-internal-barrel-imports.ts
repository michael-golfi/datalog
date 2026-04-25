import {
  createImportLikeVisitors,
  getImportSourceReportNode,
  getStaticSourceValue,
} from '../shared/imports.js';
import { resolvesToIndexBarrel } from '../shared/paths.js';

import type { Rule } from 'eslint';

export const noInternalBarrelImports: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow internal imports from index barrels, which hide dependencies and create cycles.',
    },
    schema: [],
    messages: {
      internalBarrelImport:
        'Do not import an internal barrel. Import the concrete module instead; package index surfaces are for external consumers.',
    },
  },
  create(context) {
    function checkNode(node: {
      type: string;
      source?: unknown;
      callee?: unknown;
      arguments?: unknown[];
    }): void {
      const importSource = getStaticSourceValue(node);

      if (!importSource || !resolvesToIndexBarrel(context.getFilename(), importSource)) {
        return;
      }

      context.report({
        node: getImportSourceReportNode(node) as never,
        messageId: 'internalBarrelImport',
      });
    }

    return createImportLikeVisitors(checkNode);
  },
};

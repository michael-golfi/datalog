import type { Rule } from 'eslint';

import { createImportLikeVisitors, getImportSourceReportNode, getStaticSourceValue } from '../shared/imports.js';
import { isTestPath, resolveRelativeImport } from '../shared/paths.js';

export const noProductionImportsFromTests: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow production code importing test files, fixtures, or e2e modules.',
    },
    schema: [],
    messages: {
      productionImportsTest:
        'Production code must not import test, spec, fixture, or e2e modules. Move shared helpers to a production-safe module.',
    },
  },
  create(context) {
    const filename = context.getFilename();

    if (filename === '<input>' || isTestPath(filename)) {
      return {};
    }

    function checkNode(node: { type: string; source?: unknown; callee?: unknown; arguments?: unknown[] }): void {
      const importSource = getStaticSourceValue(node);

      if (!importSource) {
        return;
      }

      const resolvedPath = resolveRelativeImport(filename, importSource);
      const sourceLooksLikeTest =
        isTestPath(importSource) || /(?:^|\/)fixtures?(?:\.|\/|$)/u.test(importSource);
      const targetLooksLikeTest = Boolean(resolvedPath && isTestPath(resolvedPath));

      if (!sourceLooksLikeTest && !targetLooksLikeTest) {
        return;
      }

      context.report({
        node: getImportSourceReportNode(node) as never,
        messageId: 'productionImportsTest',
      });
    }

    return createImportLikeVisitors(checkNode);
  },
};

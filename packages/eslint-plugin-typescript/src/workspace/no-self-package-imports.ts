import type { Rule } from 'eslint';

import { createImportLikeVisitors, getImportSourceReportNode, getStaticSourceValue } from '../shared/imports.js';
import type { PathHelpers } from '../shared/paths.js';

/** Build the rule forbidding internal code from importing its own package surface. */
export function createNoSelfPackageImports(pathHelpers: PathHelpers): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow a workspace importing its own package surface from internal source.',
      },
      schema: [],
      messages: {
        selfPackageImport:
          'This workspace is importing its own package surface. Internal code must import concrete local modules to avoid package-surface cycles.',
      },
    },
    create(context) {
      const workspaceInfo = pathHelpers.getWorkspaceInfoFromAbsolutePath(context.getFilename());
      const packageName = workspaceInfo?.packageName;

      if (!packageName) {
        return {};
      }

      const packageImportPrefix = `${packageName}/`;

      function checkNode(node: { type: string; source?: unknown; callee?: unknown; arguments?: unknown[] }): void {
        const importSource = getStaticSourceValue(node);

        if (!importSource || importSource.startsWith('.')) {
          return;
        }

        if (importSource !== packageName && !importSource.startsWith(packageImportPrefix)) {
          return;
        }

        context.report({
          node: getImportSourceReportNode(node) as never,
          messageId: 'selfPackageImport',
        });
      }

      return createImportLikeVisitors(checkNode);
    },
  };
}

import {
  createImportLikeVisitors,
  getImportSourceReportNode,
  getStaticSourceValue,
} from '../shared/imports.js';
import { hasCodeLikeExtension, resolveRelativeImport, type PathHelpers } from '../shared/paths.js';

import type { Rule } from 'eslint';

function getCrossWorkspaceTarget(
  filename: string,
  importSource: string,
  pathHelpers: PathHelpers,
): string | null {
  const sourceWorkspace = pathHelpers.getWorkspaceInfoFromAbsolutePath(filename);
  const resolvedPath = resolveRelativeImport(filename, importSource);
  const targetWorkspace = resolvedPath
    ? pathHelpers.getWorkspaceInfoFromAbsolutePath(resolvedPath)
    : null;

  if (!sourceWorkspace || !targetWorkspace || sourceWorkspace.root === targetWorkspace.root) {
    return null;
  }

  return targetWorkspace.packageName ?? targetWorkspace.root;
}

/** Build the rule forbidding relative imports across workspace boundaries. */
export function createNoCrossWorkspaceRelativeImports(pathHelpers: PathHelpers): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow relative imports that cross Yarn workspace package boundaries.',
      },
      schema: [],
      messages: {
        crossWorkspaceRelativeImport:
          'Do not import across Yarn workspaces with a relative path. Import {{target}} through its package export instead.',
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

        if (!importSource?.startsWith('.') || !hasCodeLikeExtension(importSource)) {
          return;
        }

        const target = getCrossWorkspaceTarget(context.getFilename(), importSource, pathHelpers);

        if (!target) {
          return;
        }

        context.report({
          node: getImportSourceReportNode(node) as never,
          messageId: 'crossWorkspaceRelativeImport',
          data: { target },
        });
      }

      return createImportLikeVisitors(checkNode);
    },
  };
}

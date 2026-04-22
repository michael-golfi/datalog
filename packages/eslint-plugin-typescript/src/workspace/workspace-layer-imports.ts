import type { Rule } from 'eslint';

import {
  createImportLikeVisitors,
  getImportSourceReportNode,
  getStaticSourceValue,
  isTypeOnlyImportLike,
} from '../shared/imports.js';
import { hasCodeLikeExtension, resolveRelativeImport, type PathHelpers } from '../shared/paths.js';
import type { WorkspaceLayerImportOptions, WorkspaceLayerPolicy } from './layer-policies.js';
import { getLayerName, getLayerPolicy, getRelativeInsideSourceRoot } from './layer-policies.js';

interface LayerContext {
  filename: string;
  pathHelpers: PathHelpers;
  sourcePolicy: WorkspaceLayerPolicy;
  sourceWorkspaceRoot: string;
  sourceLayer: string;
}

function getWorkspaceLayer(
  relativeInsideWorkspace: string,
  policy: WorkspaceLayerPolicy,
): string {
  return getLayerName(policy, getRelativeInsideSourceRoot(policy, relativeInsideWorkspace));
}

function getTargetLayerContext(
  importSource: string,
  layerContext: LayerContext,
  policies: WorkspaceLayerPolicy[],
): { targetLayer: string; allowedLayers: string[] } | null {
  const resolvedPath = resolveRelativeImport(layerContext.filename, importSource);
  const targetWorkspace = resolvedPath
    ? layerContext.pathHelpers.getWorkspaceInfoFromAbsolutePath(resolvedPath)
    : null;

  if (targetWorkspace?.root !== layerContext.sourceWorkspaceRoot) {
    return null;
  }

  const targetPolicy = getLayerPolicy(policies, targetWorkspace, targetWorkspace.relativeInsideWorkspace);

  if (!targetPolicy || targetPolicy !== layerContext.sourcePolicy) {
    return null;
  }

  return {
    targetLayer: getWorkspaceLayer(targetWorkspace.relativeInsideWorkspace, targetPolicy),
    allowedLayers: layerContext.sourcePolicy.allow[layerContext.sourceLayer] ?? [],
  };
}

const workspaceLayerImportSchema = [
  {
    type: 'object',
    properties: {
      policies: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            workspaceRoot: { type: 'string' },
            sourceRoot: { type: 'string' },
            defaultLayer: { type: 'string' },
            layers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  files: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  prefixes: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['name'],
                additionalProperties: false,
              },
            },
            allow: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          required: ['workspaceRoot', 'sourceRoot', 'defaultLayer', 'layers', 'allow'],
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
];

function getConfiguredPolicies(context: Rule.RuleContext): WorkspaceLayerPolicy[] {
  const option = context.options[0] as WorkspaceLayerImportOptions | undefined;
  return option?.policies ?? [];
}

function getSourceLayerContext(
  filename: string,
  pathHelpers: PathHelpers,
  policies: WorkspaceLayerPolicy[],
): LayerContext | null {
  if (policies.length === 0) {
    return null;
  }

  const sourceWorkspace = pathHelpers.getWorkspaceInfoFromAbsolutePath(filename);
  const sourcePolicy = sourceWorkspace
    ? getLayerPolicy(policies, sourceWorkspace, sourceWorkspace.relativeInsideWorkspace)
    : null;

  if (!sourceWorkspace || !sourcePolicy) {
    return null;
  }

  return {
    filename,
    pathHelpers,
    sourcePolicy,
    sourceWorkspaceRoot: sourceWorkspace.root,
    sourceLayer: getWorkspaceLayer(sourceWorkspace.relativeInsideWorkspace, sourcePolicy),
  };
}

function createLayerImportCheckNode(
  context: Rule.RuleContext,
  layerContext: LayerContext,
  policies: WorkspaceLayerPolicy[],
): (node: { type: string; source?: unknown; callee?: unknown; arguments?: unknown[] }) => void {
  return (node): void => {
    const importSource = getStaticSourceValue(node);

    if (isTypeOnlyImportLike(node) || !importSource?.startsWith('.') || !hasCodeLikeExtension(importSource)) {
      return;
    }

    const targetLayerContext = getTargetLayerContext(importSource, layerContext, policies);

    if (!targetLayerContext || targetLayerContext.allowedLayers.includes(targetLayerContext.targetLayer)) {
      return;
    }

    context.report({
      node: getImportSourceReportNode(node) as never,
      messageId: 'invalidLayerImport',
      data: {
        workspace: layerContext.sourceWorkspaceRoot,
        sourceLayer: layerContext.sourceLayer,
        targetLayer: targetLayerContext.targetLayer,
        allowedLayers: targetLayerContext.allowedLayers.join(', '),
      },
    });
  };
}

/** Build the rule enforcing intra-workspace layer import directions. */
export function createWorkspaceLayerImports(pathHelpers: PathHelpers): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      docs: {
        description: 'Enforce directional imports between configured layers inside a workspace.',
      },
      schema: workspaceLayerImportSchema,
      messages: {
        invalidLayerImport:
          'Invalid layer import in {{workspace}}: {{sourceLayer}} may not import {{targetLayer}}. Allowed target layers: {{allowedLayers}}.',
      },
    },
    create(context) {
      const layerContext = getSourceLayerContext(context.getFilename(), pathHelpers, getConfiguredPolicies(context));

      if (!layerContext) {
        return {};
      }

      return createImportLikeVisitors(createLayerImportCheckNode(context, layerContext, getConfiguredPolicies(context)));
    },
  };
}

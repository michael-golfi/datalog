import type { ESLint } from 'eslint';

import { exportedFunctionReturnType } from './exports/exported-function-return-type.js';
import { noBooleanFlagsOnExportedFunctions } from './exports/no-boolean-flags-on-exported-functions.js';
import { noGenericFilenames } from './exports/no-generic-filenames.js';
import { noReexportsOutsideIndex } from './exports/no-reexports-outside-index.js';
import { noAmbientEnvAccess } from './runtime/no-ambient-env-access.js';
import { noTopLevelMutableState } from './runtime/no-top-level-mutable-state.js';
import { createPathHelpers } from './shared/paths.js';
import { noAsyncJsxEventHandlers } from './ui/no-async-jsx-event-handlers.js';
import { noDirectFetchInUi } from './ui/no-direct-fetch-in-ui.js';
import { noHardcodedDesignValues } from './ui/no-hardcoded-design-values.js';
import { noInlineStyles } from './ui/no-inline-styles.js';
import { noNonsemanticInteractiveElements } from './ui/no-nonsemantic-interactive-elements.js';
import { noRawDesignSystemElements } from './ui/no-raw-design-system-elements.js';
import { requireButtonType } from './ui/require-button-type.js';
import { requirePageStructure } from './ui/require-page-structure.js';
import { createNoCrossWorkspaceRelativeImports } from './workspace/no-cross-workspace-relative-imports.js';
import { noInternalBarrelImports } from './workspace/no-internal-barrel-imports.js';
import { noProductionImportsFromTests } from './workspace/no-production-imports-from-tests.js';
import { createNoSelfPackageImports } from './workspace/no-self-package-imports.js';
import { createWorkspaceLayerImports } from './workspace/workspace-layer-imports.js';

/** Create the TypeScript/workspace ESLint plugin and shared path helpers. */
export function createTypeScriptWorkspacePlugin(rootDir: string): {
  plugin: ESLint.Plugin;
  pathHelpers: ReturnType<typeof createPathHelpers>;
} {
  const pathHelpers = createPathHelpers(rootDir);

  return {
    plugin: {
      rules: {
        'no-generic-filenames': noGenericFilenames,
        'no-boolean-flags-on-exported-functions': noBooleanFlagsOnExportedFunctions,
        'exported-function-return-type': exportedFunctionReturnType,
        'no-reexports-outside-index': noReexportsOutsideIndex,
        'no-raw-design-system-elements': noRawDesignSystemElements,
        'no-nonsemantic-interactive-elements': noNonsemanticInteractiveElements,
        'require-button-type': requireButtonType,
        'no-inline-styles': noInlineStyles,
        'no-hardcoded-design-values': noHardcodedDesignValues,
        'no-direct-fetch-in-ui': noDirectFetchInUi,
        'no-async-jsx-event-handlers': noAsyncJsxEventHandlers,
        'require-page-structure': requirePageStructure,
        'no-cross-workspace-relative-imports': createNoCrossWorkspaceRelativeImports(pathHelpers),
        'no-production-imports-from-tests': noProductionImportsFromTests,
        'no-internal-barrel-imports': noInternalBarrelImports,
        'no-self-package-imports': createNoSelfPackageImports(pathHelpers),
        'workspace-layer-imports': createWorkspaceLayerImports(pathHelpers),
        'no-ambient-env-access': noAmbientEnvAccess,
        'no-top-level-mutable-state': noTopLevelMutableState,
      },
    },
    pathHelpers,
  };
}

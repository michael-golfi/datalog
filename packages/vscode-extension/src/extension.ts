import {
  activateExtension,
  deactivateExtension,
} from './activation/extension-runtime.js';

import type { ExtensionContext } from 'vscode';

export async function activate(context: ExtensionContext): Promise<void> {
  await activateExtension(context);
}

export function deactivate(): Promise<void> | undefined {
  return deactivateExtension();
}

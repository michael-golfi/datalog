import {
  activateExtension,
  deactivateExtension,
} from './activation/extension-runtime.js';

export function activate(): void {
  activateExtension();
}

export function deactivate(): Promise<void> | undefined {
  return deactivateExtension();
}

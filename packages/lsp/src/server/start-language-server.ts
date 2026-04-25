import { runLanguageServer } from './run-language-server.js';
import { createLanguageServerRuntime } from '../runtime/create-language-server-runtime.js';

import type { LanguageServerRuntime } from '../contracts/language-server-runtime.js';

/** Create the parser-backed runtime and start the language server process. */
export function startLanguageServer(): LanguageServerRuntime {
  return runLanguageServer(createLanguageServerRuntime());
}

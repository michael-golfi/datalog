import type { GraphTranslationError } from './graph-translation-error.js';
import type { TranslatedSqlQuery } from './translated-sql-query.js';

export type GraphTranslationResult =
  | { readonly ok: true; readonly value: TranslatedSqlQuery }
  | { readonly ok: false; readonly error: GraphTranslationError };

export interface TranslatedSqlQuery {
  readonly operation: 'select' | 'insert' | 'delete';
  readonly text: string;
  readonly values: readonly string[];
}

import type { SqlParameterValue } from './physical-plan.js';

export interface TranslatedSqlQuery {
  readonly operation: 'select' | 'insert' | 'delete';
  readonly text: string;
  readonly values: readonly SqlParameterValue[];
}

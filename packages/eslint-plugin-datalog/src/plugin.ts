import { datalogNoDuplicatePredicateSchemas } from './datalog-no-duplicate-predicate-schemas.js';
import { datalogNoUnterminatedString } from './datalog-no-unterminated-string.js';
import { datalogProcessor } from './datalog-processor.js';
import { datalogRequireStatementTermination } from './datalog-require-statement-termination.js';

/** Create the Datalog ESLint plugin surface with its processor and Datalog-only rules. */
export function createDatalogPlugin(): {
  plugin: {
    processors: {
      datalog: typeof datalogProcessor;
    };
    rules: {
      'no-duplicate-predicate-schemas': typeof datalogNoDuplicatePredicateSchemas;
      'no-unterminated-string': typeof datalogNoUnterminatedString;
      'require-statement-termination': typeof datalogRequireStatementTermination;
    };
  };
} {
  return {
    plugin: {
      processors: {
        datalog: datalogProcessor,
      },
      rules: {
        'no-duplicate-predicate-schemas': datalogNoDuplicatePredicateSchemas,
        'no-unterminated-string': datalogNoUnterminatedString,
        'require-statement-termination': datalogRequireStatementTermination,
      },
    },
  };
}

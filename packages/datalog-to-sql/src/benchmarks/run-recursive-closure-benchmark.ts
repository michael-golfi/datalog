import { runRecursiveClosureBenchmark } from './recursive-closure-benchmark-runner.js';

const report = await runRecursiveClosureBenchmark({
  validate: process.argv.includes('--validate'),
});

const executionSummary = report.executionTimesMs.map((value) => `${value}ms`).join(', ');

process.stdout.write('Recursive closure benchmark complete.\n');
process.stdout.write(`PostgreSQL major version: ${report.postgresMajorVersion}\n`);
process.stdout.write(`Closure row count: ${report.measuredClosureRowCount}\n`);
process.stdout.write(`Execution times: ${executionSummary}\n`);
process.stdout.write(
  report.validation.ok
    ? 'Validation: pass\n'
    : `Validation: fail - ${report.validation.reasons.join(' ')}\n`,
);

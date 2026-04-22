import { spawnSync } from 'node:child_process';

export interface BenchmarkCommandOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly throwOnFailure?: boolean;
  readonly input?: string;
}

/** Run a benchmark support command and return its stdout. */
export function runCommand({ command, args, throwOnFailure = true, input }: BenchmarkCommandOptions): string {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    input,
  });

  if (result.status === 0) {
    return result.stdout;
  }

  if (!throwOnFailure) {
    return result.stdout;
  }

  throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.trim()}`);
}

/** Block the current thread for a short benchmarking delay. */
export function sleep(durationMs: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { resolveMedicalOntologyWorkspacePath } from './medical-ontology-workspace-path-support.js';

const require = createRequire(import.meta.url);

export function cleanupTemporaryOntologyWorkspaces(temporaryRoots: string[]): void {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
}

export function createOntologyMigrationWorkspaceFixture(temporaryRoots: string[]): string {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'medical-ontology-cli-harness-'));
  temporaryRoots.push(workspaceRoot);
  mkdirSync(path.join(workspaceRoot, 'migrations'), { recursive: true });
  writeFileSync(path.join(workspaceRoot, 'current.dl'), '% Current mutable ontology working area.\n', 'utf8');
  return workspaceRoot;
}

export function replayCanonicalOntologyMigrationChain(workspaceRoot: string): readonly string[] {
  for (const step of loadCanonicalOntologyMigrationSteps()) {
    writeFileSync(path.join(workspaceRoot, 'current.dl'), step.body, 'utf8');
    const commitResult = runPublicCommitCli(workspaceRoot, ['--message', step.slug]);

    if (commitResult.status !== 0) {
      throw new Error(`Expected ontology migration replay to commit successfully, received: ${commitResult.stderr || commitResult.stdout}`);
    }
  }

  return readdirSync(path.join(workspaceRoot, 'migrations')).sort();
}

export function runPublicCommitCli(workspaceRoot: string, args: readonly string[]): {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
} {
  const result = spawnSync(process.execPath, [resolvePublicDatalogMigrateCommitExecutablePath(), ...args], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function resolvePublicDatalogMigrateCommitExecutablePath(): string {
  const packageJsonPath = require.resolve('@datalog/datalog-migrate/package.json');
  const packageRoot = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    readonly bin?: Record<string, string>;
  };
  const executableRelativePath = packageJson.bin?.['datalog-migrate-commit'];

  if (typeof executableRelativePath !== 'string') {
    throw new Error('Expected @datalog/datalog-migrate/package.json to expose a datalog-migrate-commit binary.');
  }

  return path.join(packageRoot, executableRelativePath);
}

function loadCanonicalOntologyMigrationSteps(): readonly CanonicalOntologyMigrationStep[] {
  return readdirSync(resolveMedicalOntologyWorkspacePath('migrations'))
    .filter((fileName) => fileName.endsWith('.dl'))
    .sort()
    .map((fileName) => ({
      slug: deriveMigrationSlug(fileName),
      body: stripCommittedMigrationMetadata(
        readFileSync(resolveMedicalOntologyWorkspacePath('migrations', fileName), 'utf8'),
      ),
    }));
}

function deriveMigrationSlug(fileName: string): string {
  const stem = fileName.replace(/^\d{8}\.\d{4}\./u, '').replace(/\.dl$/u, '');
  return stem.replace(/-/gu, ' ');
}

function stripCommittedMigrationMetadata(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.startsWith('% migration.previous:') && !line.startsWith('% migration.sha256:'))
    .join('\n')
    .replace(/^\n/u, '');
}

interface CanonicalOntologyMigrationStep {
  readonly slug: string;
  readonly body: string;
}

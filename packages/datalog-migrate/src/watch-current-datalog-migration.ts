#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadDatalogMigrationProjectFiles } from './load-datalog-migration-project-files.js';

export interface DatalogWatchSnapshot {
  readonly committedMigrationFileNames: readonly string[];
  readonly currentMigrationPath: string;
  readonly hasCurrentChanges: boolean;
  readonly currentContentHash: string | null;
}

export interface WatchCurrentDatalogMigrationOptions {
  readonly workspaceRoot?: string;
  readonly pollIntervalMs?: number;
  readonly maxSnapshots?: number;
  readonly onSnapshot?: (snapshot: DatalogWatchSnapshot) => void;
  readonly timeoutMs?: number;
}

interface WatchLoopInput {
  readonly options: WatchCurrentDatalogMigrationOptions;
  readonly emitSnapshot: (snapshot: DatalogWatchSnapshot) => void;
  readonly pollIntervalMs: number;
  readonly maxSnapshots: number;
}

interface WatchLoopState {
  snapshotCount: number;
  lastSnapshotKey: string;
  stopped: boolean;
}

/** Read the current committed-plus-current watch state for a Datalog migration workspace. */
export function readDatalogWatchSnapshot(
  options: { readonly workspaceRoot?: string } = {},
): DatalogWatchSnapshot {
  const projectFiles = loadDatalogMigrationProjectFiles(options);
  const currentSource = readFileSync(projectFiles.currentMigrationPath, 'utf8');
  const hasCurrentChanges = hasMeaningfulCurrentContent(currentSource);

  return {
    committedMigrationFileNames: projectFiles.committedMigrations.map((migration) => migration.fileName),
    currentMigrationPath: projectFiles.currentMigrationPath,
    hasCurrentChanges,
    currentContentHash: hasCurrentChanges ? hashCurrentContent(currentSource) : null,
  };
}

/** Watch the committed-plus-current migration workflow and emit snapshots when current.dl changes. */
export async function watchCurrentDatalogMigration(
  options: WatchCurrentDatalogMigrationOptions = {},
): Promise<void> {
  await runWatchLoop({
    options,
    emitSnapshot: options.onSnapshot ?? defaultSnapshotEmitter,
    pollIntervalMs: options.pollIntervalMs ?? 250,
    maxSnapshots: options.maxSnapshots ?? Number.POSITIVE_INFINITY,
  });
}

function defaultSnapshotEmitter(snapshot: DatalogWatchSnapshot): void {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

async function runWatchLoop(input: WatchLoopInput): Promise<void> {
  const state: WatchLoopState = {
    snapshotCount: 0,
    lastSnapshotKey: '',
    stopped: false,
  };

  await new Promise<void>((resolve, reject) => {
    const handles = {
      intervalId: undefined as ReturnType<typeof setInterval> | undefined,
      timeoutId: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    const stopWatching = createStopWatching(state, handles, resolve);
    const emitIfChanged = createEmitIfChanged(input, state, { stopWatching, reject });

    handles.intervalId = setInterval(emitIfChanged, input.pollIntervalMs);
    handles.timeoutId = input.options.timeoutMs === undefined
      ? undefined
      : setTimeout(stopWatching, input.options.timeoutMs);

    emitIfChanged();
  });
}

function createEmitIfChanged(
  input: WatchLoopInput,
  state: WatchLoopState,
  callbacks: {
    readonly stopWatching: () => void;
    readonly reject: (reason?: unknown) => void;
  },
): () => void {
  return () => {
    if (state.stopped) {
      return;
    }

    try {
      const snapshot = readDatalogWatchSnapshot(input.options);
      const snapshotKey = JSON.stringify(snapshot);

      if (snapshotKey === state.lastSnapshotKey) {
        return;
      }

      state.lastSnapshotKey = snapshotKey;
      input.emitSnapshot(snapshot);
      state.snapshotCount += 1;

      if (state.snapshotCount >= input.maxSnapshots) {
        callbacks.stopWatching();
      }
    } catch (error) {
      callbacks.stopWatching();
      callbacks.reject(error);
    }
  };
}

function createStopWatching(
  state: WatchLoopState,
  handles: {
    intervalId: ReturnType<typeof setInterval> | undefined;
    timeoutId: ReturnType<typeof setTimeout> | undefined;
  },
  resolve: () => void,
): () => void {
  return () => {
    if (state.stopped) {
      return;
    }

    state.stopped = true;
    if (handles.intervalId) {
      clearInterval(handles.intervalId);
    }
    if (handles.timeoutId) {
      clearTimeout(handles.timeoutId);
    }
    resolve();
  };
}

function hasMeaningfulCurrentContent(source: string): boolean {
  return source
    .split('\n')
    .some((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('%');
    });
}

function hashCurrentContent(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await watchCurrentDatalogMigration();
}

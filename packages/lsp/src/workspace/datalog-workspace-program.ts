import { pathToFileURL } from 'node:url';

import {
  parseDatalogProgramSources,
  type ParsedDatalogProgramSources,
} from '@datalog/parser';
import type { DatalogMigrationProjectFiles } from '@datalog/datalog-migrate/load-datalog-migration-project-files';

import type { DatalogWorkspaceDocument } from './load-datalog-workspace-documents.js';

type LoadMigrationProjectFiles = (options: { readonly workspaceRoot: string }) => DatalogMigrationProjectFiles;

/** Build the parser-owned whole-program view for a migration workspace. */
export function buildDatalogWorkspaceProgram(options: {
  readonly documents: readonly DatalogWorkspaceDocument[];
  readonly workspaceRootPath: string | null;
  readonly loadMigrationProjectFiles: LoadMigrationProjectFiles;
}): ParsedDatalogProgramSources | null {
  const orderedDocuments = getMigrationProgramDocuments(options);
  if (!orderedDocuments || orderedDocuments.length === 0) {
    return null;
  }

  return buildParsedWorkspaceProgram(orderedDocuments);
}

function buildParsedWorkspaceProgram(
  orderedDocuments: readonly DatalogWorkspaceDocument[],
): ParsedDatalogProgramSources | null {
  try {
    return parseDatalogProgramSources(orderedDocuments.map((document) => ({
      sourceId: document.uri,
      source: document.source,
    })));
  } catch {
    return null;
  }
}

function getMigrationProgramDocuments(options: {
  readonly documents: readonly DatalogWorkspaceDocument[];
  readonly workspaceRootPath: string | null;
  readonly loadMigrationProjectFiles: LoadMigrationProjectFiles;
}): readonly DatalogWorkspaceDocument[] | null {
  const migrationProjectFiles = loadMigrationProjectFilesSafely(options);
  if (!migrationProjectFiles) {
    return null;
  }

  const documentsByUri = new Map(options.documents.map((document) => [document.uri, document] as const));
  const orderedUris = [
    ...migrationProjectFiles.committedMigrationPaths,
    migrationProjectFiles.currentMigrationPath,
  ].map((filePath) => pathToFileURL(filePath).href);

  return orderedUris.flatMap((uri) => {
    const document = documentsByUri.get(uri);
    return document ? [document] : [];
  });
}

function loadMigrationProjectFilesSafely(options: {
  readonly workspaceRootPath: string | null;
  readonly loadMigrationProjectFiles: LoadMigrationProjectFiles;
}): DatalogMigrationProjectFiles | null {
  if (!options.workspaceRootPath) {
    return null;
  }

  try {
    return options.loadMigrationProjectFiles({ workspaceRoot: options.workspaceRootPath });
  } catch {
    return null;
  }
}

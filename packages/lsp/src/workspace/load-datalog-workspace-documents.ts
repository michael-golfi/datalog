import { pathToFileURL } from 'node:url';

import type { ParsedDocument, parseDocument } from '@datalog/parser';

import type { listDatalogWorkspaceFiles } from './datalog-workspace-files.js';
import type { readFile } from 'node:fs/promises';

export interface DatalogWorkspaceDocument {
  readonly uri: string;
  readonly source: string;
  readonly parsedDocument: ParsedDocument;
}

/** Load and parse workspace `.dl` documents while tolerating transient filesystem races. */
export async function loadDatalogWorkspaceDocuments(options: {
  readonly workspaceRootPath: string | null;
  readonly listWorkspaceFiles: typeof listDatalogWorkspaceFiles;
  readonly readWorkspaceFile: typeof readFile;
  readonly parseWorkspaceDocument: typeof parseDocument;
}): Promise<Map<string, DatalogWorkspaceDocument>> {
  if (!options.workspaceRootPath) {
    return new Map();
  }

  const filePaths = await options.listWorkspaceFiles(options.workspaceRootPath);
  const documents = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const source = await options.readWorkspaceFile(filePath, 'utf8');
        const uri = pathToFileURL(filePath).href;

        return [
          uri,
          {
            uri,
            source,
            parsedDocument: options.parseWorkspaceDocument(source),
          },
        ] as const;
      } catch (error) {
        if (isSkippableWorkspaceFsError(error)) {
          return null;
        }

        throw error;
      }
    }),
  );

  return new Map(
    documents.filter((document): document is NonNullable<typeof document> => document !== null),
  );
}

function isSkippableWorkspaceFsError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }

  return (
    error.code === 'ENOENT' ||
    error.code === 'ENOTDIR' ||
    error.code === 'EACCES' ||
    error.code === 'EPERM'
  );
}

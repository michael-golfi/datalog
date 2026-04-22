import type { Linter } from 'eslint';

const VIRTUAL_PREFIX = '/*__DATALOG__\n';
const VIRTUAL_SUFFIX = '\n*/';

/** Wrap raw Datalog text in the virtual source envelope used by the processor. */
export function createVirtualDatalogSource(source: string): string {
  return `${VIRTUAL_PREFIX}${source}${VIRTUAL_SUFFIX}`;
}

/** Extract the original Datalog text from a virtualized processor input. */
export function extractDatalogSource(virtualSource: string): string {
  if (!virtualSource.startsWith(VIRTUAL_PREFIX) || !virtualSource.endsWith(VIRTUAL_SUFFIX)) {
    return virtualSource;
  }

  return virtualSource.slice(VIRTUAL_PREFIX.length, -VIRTUAL_SUFFIX.length);
}

/** Create the virtual filename suffix used for processed Datalog files. */
export function createDatalogVirtualFilename(filename: string): string {
  return `${filename}.__datalog__`;
}

/** Convert a byte offset in a source string into a line/column location. */
export function offsetToLoc(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastLineStart = 0;

  for (let index = 0; index < Math.min(offset, source.length); index += 1) {
    if (source[index] === '\n') {
      line += 1;
      lastLineStart = index + 1;
    }
  }

  return {
    line,
    column: offset - lastLineStart,
  };
}

/** Remap a Datalog location into the wrapped virtual-source coordinate space. */
export function toVirtualLoc(
  source: string,
  startOffset: number,
  endOffset = startOffset + 1,
): {
  start: { line: number; column: number };
  end: { line: number; column: number };
} {
  const start = offsetToLoc(source, startOffset);
  const end = offsetToLoc(source, endOffset);

  return {
    start: {
      line: start.line + 1,
      column: start.column,
    },
    end: {
      line: end.line + 1,
      column: end.column,
    },
  };
}

/** Shift lint messages from the wrapped virtual file back onto the original Datalog source lines. */
export function remapDatalogMessages(messageLists: Linter.LintMessage[][]): Linter.LintMessage[] {
  return messageLists.flat().map((message) => ({
    ...message,
    line: Math.max(1, message.line - 1),
    ...(message.endLine === undefined ? {} : { endLine: Math.max(1, message.endLine - 1) }),
  }));
}

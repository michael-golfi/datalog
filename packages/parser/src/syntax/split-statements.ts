export interface Statement {
  readonly text: string;
  readonly startOffset: number;
}

interface StatementSplitState {
  buffer: string;
  currentOffset: number;
  statementStart: number | null;
}

/** Split source text into top-level Datalog statements while preserving offsets. */
export function splitStatements(source: string): Statement[] {
  const statements: Statement[] = [];
  const state: StatementSplitState = {
    buffer: '',
    currentOffset: 0,
    statementStart: null,
  };

  for (const line of source.split('\n')) {
    processStatementLine(statements, state, line);
  }

  appendTrailingStatement(statements, state);

  return statements;
}

function processStatementLine(statements: Statement[], state: StatementSplitState, line: string): void {
  const lineWithBreak = `${line}\n`;
  const trimmed = line.trim();

  if (shouldStartStatement(state.statementStart, trimmed)) {
    state.statementStart = state.currentOffset;
  }

  if (state.statementStart !== null) {
    state.buffer += lineWithBreak;

    if (trimmed.endsWith('.')) {
      appendStatement(statements, state.buffer, state.statementStart);
      state.buffer = '';
      state.statementStart = null;
    }
  }

  state.currentOffset += lineWithBreak.length;
}

function appendTrailingStatement(statements: Statement[], state: StatementSplitState): void {
  if (state.statementStart !== null && state.buffer.trim().length > 0) {
    appendStatement(statements, state.buffer, state.statementStart);
  }
}

function shouldStartStatement(statementStart: number | null, trimmedLine: string): boolean {
  return statementStart === null && trimmedLine.length > 0 && !trimmedLine.startsWith('%');
}

function appendStatement(statements: Statement[], buffer: string, startOffset: number): void {
  statements.push({
    text: buffer.trimEnd(),
    startOffset,
  });
}

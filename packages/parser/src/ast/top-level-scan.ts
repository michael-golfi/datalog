interface ScanState {
  depth: number;
  inString: boolean;
}

/** Find the first top-level `:-` divider in a clause-like string. */
export function findTopLevelRuleDivider(text: string): number {
  const state: ScanState = { depth: 0, inString: false };

  for (let index = 0; index < text.length - 1; index += 1) {
    updateScanState(state, text, index);

    if (!state.inString && state.depth === 0 && text[index] === ':' && text[index + 1] === '-') {
      return index;
    }
  }

  return -1;
}

/** Find the first top-level comparison operator in a literal-like string. */
export function findTopLevelComparisonOperator(text: string): { operator: string; index: number } | null {
  const state: ScanState = { depth: 0, inString: false };
  const operators = ['!=', '<=', '>=', '=', '<', '>'] as const;

  for (let index = 0; index < text.length; index += 1) {
    updateScanState(state, text, index);

    if (state.inString || state.depth !== 0) {
      continue;
    }

    const operator = operators.find((candidate) => text.startsWith(candidate, index));

    if (operator !== undefined) {
      return { operator, index };
    }
  }

  return null;
}

/** Find the first top-level `=` used by a named argument. */
export function findTopLevelAssignment(text: string): number {
  const state: ScanState = { depth: 0, inString: false };

  for (let index = 0; index < text.length; index += 1) {
    updateScanState(state, text, index);

    if (!state.inString && state.depth === 0 && text[index] === '=') {
      return index;
    }
  }

  return -1;
}

/** Split a query/rule body on top-level commas only. */
export function splitTopLevelConjunction(text: string): string[] {
  const state: ScanState = { depth: 0, inString: false };
  const parts: string[] = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    updateScanState(state, text, index);

    if (!state.inString && state.depth === 0 && text[index] === ',') {
      pushPart(parts, text.slice(start, index));
      start = index + 1;
    }
  }

  pushPart(parts, text.slice(start));
  return parts;
}

function updateScanState(state: ScanState, text: string, index: number): void {
  const character = text[index];

  if (character === '"' && text[index - 1] !== '\\') {
    state.inString = !state.inString;
    return;
  }

  if (state.inString) {
    return;
  }

  if (character === '(') {
    state.depth += 1;
    return;
  }

  if (character === ')') {
    state.depth -= 1;
  }
}

function pushPart(parts: string[], value: string): void {
  const trimmed = value.trim();

  if (trimmed.length > 0) {
    parts.push(trimmed);
  }
}

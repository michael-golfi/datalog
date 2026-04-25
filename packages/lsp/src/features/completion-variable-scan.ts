/** Check whether the current token looks like a clause-local variable position. */
export function isVariableTermPosition(argumentPrefix: string, tokenPrefix: string): boolean {
  if (tokenPrefix.length === 0 || !/^[A-Z_][A-Za-z0-9_]*$/.test(tokenPrefix)) {
    return false;
  }

  return !argumentPrefix.includes('"');
}

/** Collect previously declared variables from the current clause prefix. */
export function collectClauseVariables(
  clausePrefix: string,
  currentTokenPrefix: string,
): readonly string[] {
  const variables = new Set<string>();
  const state = { inComment: false, inString: false };

  for (let index = 0; index < clausePrefix.length; index += 1) {
    index = scanClauseVariable({ clausePrefix, index, state, currentTokenPrefix, variables });
  }

  return [...variables].sort((left, right) => left.localeCompare(right));
}

function scanClauseVariable(options: {
  readonly clausePrefix: string;
  readonly index: number;
  readonly state: { inComment: boolean; inString: boolean };
  readonly currentTokenPrefix: string;
  readonly variables: Set<string>;
}): number {
  if (
    advanceQuotedOrCommentState({
      source: options.clausePrefix,
      index: options.index,
      state: options.state,
    })
  ) {
    return options.index;
  }

  const character = options.clausePrefix[options.index] ?? '';
  if (enterQuotedOrCommentState(options.state, character)) {
    return options.index;
  }

  if (!isVariableCandidate(options.clausePrefix, options.index, character)) {
    return options.index;
  }

  const variableMatch = getVariableMatch(options.clausePrefix, options.index);
  if (variableMatch.isTerm && variableMatch.name !== options.currentTokenPrefix) {
    options.variables.add(variableMatch.name);
  }

  return variableMatch.endIndex - 1;
}

function enterQuotedOrCommentState(
  state: { inComment: boolean; inString: boolean },
  character: string,
): boolean {
  if (character !== '%' && character !== '"') {
    return false;
  }

  state.inComment = character === '%';
  state.inString = character === '"';
  return true;
}

function isVariableCandidate(clausePrefix: string, index: number, character: string): boolean {
  return isVariableStart(character) && !isIdentifierContinuation(clausePrefix[index - 1]);
}

function advanceQuotedOrCommentState(options: {
  readonly source: string;
  readonly index: number;
  readonly state: { inComment: boolean; inString: boolean };
}): boolean {
  const character = options.source[options.index] ?? '';
  if (options.state.inComment) {
    options.state.inComment = character !== '\n';
    return true;
  }

  if (!options.state.inString) {
    return false;
  }

  options.state.inString = !isClosingQuote(options.source, options.index);
  return true;
}

function getVariableMatch(
  clausePrefix: string,
  startIndex: number,
): {
  readonly name: string;
  readonly endIndex: number;
  readonly isTerm: boolean;
} {
  let endIndex = startIndex + 1;
  while (isIdentifierContinuation(clausePrefix[endIndex])) {
    endIndex += 1;
  }

  const name = clausePrefix.slice(startIndex, endIndex);
  let lookaheadIndex = endIndex;
  while (clausePrefix[lookaheadIndex] === ' ' || clausePrefix[lookaheadIndex] === '\t') {
    lookaheadIndex += 1;
  }

  return { name, endIndex, isTerm: !isCallBoundary(clausePrefix, lookaheadIndex) };
}

function isCallBoundary(source: string, index: number): boolean {
  return source[index] === '(' || (source[index] === '@' && source[index + 1] === '(');
}

function isClosingQuote(source: string, index: number): boolean {
  return source[index] === '"' && source[index - 1] !== '\\';
}

function isIdentifierContinuation(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function isVariableStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Z_]/.test(character);
}

export interface ActiveCall {
  readonly name: string;
  readonly isCompound: boolean;
  readonly argIndex: number;
  readonly argumentStart: number;
}

export type QuotedCompletionSlotKind = 'graph-predicate-string' | 'node-id-string';

export interface StatementScanMutableState {
  inComment: boolean;
  inString: boolean;
  stringPrefix: string;
  activeCall: ActiveCall | null;
  currentArgumentPrefix: string;
  currentTokenPrefix: string;
}

interface CallMatch {
  readonly name: string;
  readonly isCompound: boolean;
  readonly argumentStart: number;
  readonly nextIndex: number;
}

/** Advance string/comment state for the current character. */
export function consumeQuotedOrCommentState(
  prefix: string,
  index: number,
  state: Pick<StatementScanMutableState, 'inComment' | 'inString' | 'stringPrefix'>,
): boolean {
  const character = prefix[index] ?? '';

  if (state.inComment) {
    state.inComment = character !== '\n';
    return true;
  }

  if (state.inString) {
    updateStringState({ prefix, index, state, character });
    return true;
  }

  if (character !== '%' && character !== '"') {
    return false;
  }

  state.inComment = character === '%';
  state.inString = character === '"';
  state.stringPrefix = '';
  return true;
}

/** Reset call-tracking state from a newly matched function or compound call. */
export function applyCallMatchState(
  state: Pick<StatementScanMutableState, 'activeCall' | 'currentArgumentPrefix' | 'currentTokenPrefix'>,
  callMatch: Pick<CallMatch, 'name' | 'isCompound' | 'argumentStart'>,
): void {
  state.activeCall = {
    name: callMatch.name,
    isCompound: callMatch.isCompound,
    argIndex: 0,
    argumentStart: callMatch.argumentStart,
  };
  state.currentArgumentPrefix = '';
  state.currentTokenPrefix = '';
}

/** Classify which quoted-string completion slot is active for a call argument. */
export function getStringSlotKind(activeCall: ActiveCall): QuotedCompletionSlotKind | null {
  if (
    (activeCall.name === 'Edge' && activeCall.argIndex === 1) ||
    (activeCall.name === 'DefPred' && activeCall.argIndex === 0)
  ) {
    return 'graph-predicate-string';
  }

  if (activeCall.name === 'Edge' && (activeCall.argIndex === 0 || activeCall.argIndex === 2)) {
    return 'node-id-string';
  }

  return null;
}

/** Advance argument-tracking state for the current call character. */
export function updateCallState(
  prefix: string,
  index: number,
  activeCall: ActiveCall,
): Pick<StatementScanMutableState, 'activeCall' | 'currentArgumentPrefix' | 'currentTokenPrefix'> {
  const character = prefix[index] ?? '';
  if (character === ',') {
    return {
      activeCall: {
        name: activeCall.name,
        isCompound: activeCall.isCompound,
        argIndex: activeCall.argIndex + 1,
        argumentStart: index + 1,
      },
      currentArgumentPrefix: '',
      currentTokenPrefix: '',
    };
  }

  if (character === ')') {
    return { activeCall: null, currentArgumentPrefix: '', currentTokenPrefix: '' };
  }

  const currentArgumentPrefix = prefix.slice(activeCall.argumentStart, index + 1).trimStart();
  return {
    activeCall,
    currentArgumentPrefix,
    currentTokenPrefix: getIdentifierPrefix(currentArgumentPrefix),
  };
}

/** Match a function-like or compound-like call starting at `startIndex`. */
export function getCallMatch(prefix: string, startIndex: number): CallMatch | null {
  const startCharacter = prefix[startIndex];
  if (!isIdentifierStart(startCharacter) || isIdentifierContinuation(prefix[startIndex - 1])) {
    return null;
  }

  let endIndex = startIndex + 1;
  while (isIdentifierContinuation(prefix[endIndex])) {
    endIndex += 1;
  }

  const name = prefix.slice(startIndex, endIndex);
  const isCompound = prefix[endIndex] === '@';
  let openParenIndex = isCompound ? endIndex + 1 : endIndex;
  while (prefix[openParenIndex] === ' ' || prefix[openParenIndex] === '\t') {
    openParenIndex += 1;
  }

  if (prefix[openParenIndex] !== '(') {
    return null;
  }

  return { name, isCompound, argumentStart: openParenIndex + 1, nextIndex: openParenIndex };
}

function updateStringState(options: {
  readonly prefix: string;
  readonly index: number;
  readonly state: { inString: boolean; stringPrefix: string };
  readonly character: string;
}): void {
  if (isClosingQuote(options.prefix, options.index)) {
    options.state.inString = false;
    options.state.stringPrefix = '';
    return;
  }

  options.state.stringPrefix += options.character;
}

function isClosingQuote(prefix: string, index: number): boolean {
  return prefix[index] === '"' && prefix[index - 1] !== '\\';
}

function getIdentifierPrefix(input: string): string {
  return /([A-Za-z_][A-Za-z0-9_/-]*)$/.exec(input)?.[1] ?? '';
}

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierContinuation(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

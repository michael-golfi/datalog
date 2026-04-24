export interface StatementScanResult {
  readonly inComment: boolean;
  readonly inString: boolean;
  readonly stringPrefix: string;
  readonly activeCall: ActiveCall | null;
  readonly currentArgumentPrefix: string;
  readonly currentTokenPrefix: string;
}

interface ActiveCall {
  readonly name: string;
  readonly isCompound: boolean;
  readonly argIndex: number;
  readonly argumentStart: number;
}

type QuotedCompletionSlot =
  | { readonly kind: 'graph-predicate-string'; readonly prefix: string }
  | { readonly kind: 'node-id-string'; readonly prefix: string };

/** Scan the current statement prefix to classify comment, string, and call context. */
export function scanStatementPrefix(prefix: string): StatementScanResult {
  const state = {
    inComment: false,
    inString: false,
    stringPrefix: '',
    activeCall: null as ActiveCall | null,
    currentArgumentPrefix: '',
    currentTokenPrefix: '',
  };

  for (let index = 0; index < prefix.length; index += 1) {
    index = scanStatementCharacter(prefix, index, state);
  }

  if (state.activeCall) {
    state.currentArgumentPrefix = prefix.slice(state.activeCall.argumentStart).trimStart();
    state.currentTokenPrefix = getIdentifierPrefix(state.currentArgumentPrefix);
  }

  return state;
}

/** Map an unterminated quoted string position to the allowed completion slot. */
export function getStringCompletionSlot(activeCall: ActiveCall | null, prefix: string): QuotedCompletionSlot | null {
  if (!activeCall) {
    return null;
  }

  const kind = getStringSlotKind(activeCall);
  return kind ? { kind, prefix } : null;
}

/** Check whether the current compound call argument is still at a field key position. */
export function isCompoundFieldKeyPosition(argumentPrefix: string): boolean {
  return !argumentPrefix.includes('=');
}

/** Read the identifier-like suffix to complete for a compound field key. */
export function getCompoundFieldPrefix(argumentPrefix: string): string {
  return getIdentifierPrefix(argumentPrefix);
}

/** Check whether the cursor is currently at a predicate position on the line. */
export function isPredicatePosition(currentLinePrefix: string): boolean {
  return /(?:^|:-|,)\s*[A-Za-z_][A-Za-z0-9_]*$/.test(currentLinePrefix)
    || /(?:^|:-|,)\s*$/.test(currentLinePrefix.trimEnd())
    || /^\s*[A-Za-z_][A-Za-z0-9_]*$/.test(currentLinePrefix);
}

/** Read the trailing identifier-like completion prefix from an input fragment. */
export function getIdentifierPrefix(input: string): string {
  return /([A-Za-z_][A-Za-z0-9_/-]*)$/.exec(input)?.[1] ?? '';
}

function consumeQuotedOrCommentState(
  prefix: string,
  index: number,
  state: {
    inComment: boolean;
    inString: boolean;
    stringPrefix: string;
  },
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

function scanStatementCharacter(
  prefix: string,
  index: number,
  state: {
    inComment: boolean;
    inString: boolean;
    stringPrefix: string;
    activeCall: ActiveCall | null;
    currentArgumentPrefix: string;
    currentTokenPrefix: string;
  },
): number {
  if (consumeQuotedOrCommentState(prefix, index, state)) {
    return index;
  }

  const callMatch = getCallMatch(prefix, index);
  if (callMatch) {
    applyCallMatchState(state, callMatch);
    return callMatch.nextIndex;
  }

  if (state.activeCall) {
    ({ activeCall: state.activeCall, currentArgumentPrefix: state.currentArgumentPrefix, currentTokenPrefix: state.currentTokenPrefix } = updateCallState(prefix, index, state.activeCall));
  }

  return index;
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

function applyCallMatchState(
  state: { activeCall: ActiveCall | null; currentArgumentPrefix: string; currentTokenPrefix: string },
  callMatch: { readonly name: string; readonly isCompound: boolean; readonly argumentStart: number },
): void {
  state.activeCall = { name: callMatch.name, isCompound: callMatch.isCompound, argIndex: 0, argumentStart: callMatch.argumentStart };
  state.currentArgumentPrefix = '';
  state.currentTokenPrefix = '';
}

function getStringSlotKind(activeCall: ActiveCall): QuotedCompletionSlot['kind'] | null {
  if ((activeCall.name === 'Edge' && activeCall.argIndex === 1) || (activeCall.name === 'DefPred' && activeCall.argIndex === 0)) {
    return 'graph-predicate-string';
  }

  if (activeCall.name === 'Edge' && (activeCall.argIndex === 0 || activeCall.argIndex === 2)) {
    return 'node-id-string';
  }

  return null;
}

function updateCallState(prefix: string, index: number, activeCall: ActiveCall): {
  readonly activeCall: ActiveCall | null;
  readonly currentArgumentPrefix: string;
  readonly currentTokenPrefix: string;
} {
  const character = prefix[index] ?? '';
  if (character === ',') {
    return {
      activeCall: { name: activeCall.name, isCompound: activeCall.isCompound, argIndex: activeCall.argIndex + 1, argumentStart: index + 1 },
      currentArgumentPrefix: '',
      currentTokenPrefix: '',
    };
  }

  if (character === ')') {
    return { activeCall: null, currentArgumentPrefix: '', currentTokenPrefix: '' };
  }

  const currentArgumentPrefix = prefix.slice(activeCall.argumentStart, index + 1).trimStart();
  return { activeCall, currentArgumentPrefix, currentTokenPrefix: getIdentifierPrefix(currentArgumentPrefix) };
}

function isClosingQuote(prefix: string, index: number): boolean {
  return prefix[index] === '"' && prefix[index - 1] !== '\\';
}

function getCallMatch(prefix: string, startIndex: number): {
  readonly name: string;
  readonly isCompound: boolean;
  readonly argumentStart: number;
  readonly nextIndex: number;
} | null {
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

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierContinuation(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

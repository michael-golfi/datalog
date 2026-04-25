import {
  applyCallMatchState,
  consumeQuotedOrCommentState,
  getCallMatch,
  getStringSlotKind,
  updateCallState,
  type ActiveCall,
  type QuotedCompletionSlotKind,
  type StatementScanMutableState,
} from './completion-scan-core.js';

export interface StatementScanResult {
  readonly inComment: boolean;
  readonly inString: boolean;
  readonly stringPrefix: string;
  readonly activeCall: ActiveCall | null;
  readonly currentArgumentPrefix: string;
  readonly currentTokenPrefix: string;
}

interface QuotedCompletionSlot {
  readonly kind: QuotedCompletionSlotKind;
  readonly prefix: string;
}

/** Scan the current statement prefix to classify comment, string, and call context. */
export function scanStatementPrefix(prefix: string): StatementScanResult {
  const state = {
    inComment: false,
    inString: false,
    stringPrefix: '',
    activeCall: null as ActiveCall | null,
    currentArgumentPrefix: '',
    currentTokenPrefix: '',
  } satisfies StatementScanMutableState;

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
export function getStringCompletionSlot(
  activeCall: ActiveCall | null,
  prefix: string,
): QuotedCompletionSlot | null {
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
  return (
    /(?:^|:-|,)\s*[A-Za-z_][A-Za-z0-9_]*$/.test(currentLinePrefix) ||
    /(?:^|:-|,)\s*$/.test(currentLinePrefix.trimEnd()) ||
    /^\s*[A-Za-z_][A-Za-z0-9_]*$/.test(currentLinePrefix)
  );
}

/** Read the trailing identifier-like completion prefix from an input fragment. */
export function getIdentifierPrefix(input: string): string {
  return /([A-Za-z_][A-Za-z0-9_/-]*)$/.exec(input)?.[1] ?? '';
}

function scanStatementCharacter(
  prefix: string,
  index: number,
  state: StatementScanMutableState,
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
    ({
      activeCall: state.activeCall,
      currentArgumentPrefix: state.currentArgumentPrefix,
      currentTokenPrefix: state.currentTokenPrefix,
    } = updateCallState(prefix, index, state.activeCall));
  }

  return index;
}

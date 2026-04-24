interface StructuralScanState {
  depth: number;
  inString: boolean;
  inComment: boolean;
}

/** Visit characters that are not inside strings, comments, or nested parentheses. */
export function forEachTopLevelStructuralCharacter(
  text: string,
  visitTopLevelCharacter: (index: number) => number | void,
): void {
  const state = createStructuralScanState();

  for (let index = 0; index < text.length; index += 1) {
    const nextIndex = getTopLevelVisitIndex({
      text,
      index,
      state,
      visitTopLevelCharacter,
    });

    if (nextIndex === undefined) {
      continue;
    }

    index = nextIndex;
  }
}

/** Find the matching close paren while ignoring strings and `%` comments. */
export function findMatchingStructuralCloseParen(text: string, openParenOffset: number): number {
  if (openParenOffset < 0) {
    return -1;
  }

  const state = createStructuralScanState();

  for (let index = openParenOffset; index < text.length; index += 1) {
    const matchIndex = getCloseParenMatchIndex(text, index, state);

    if (matchIndex === undefined) {
      continue;
    }

    return matchIndex;
  }

  return -1;
}

function getTopLevelVisitIndex(
  input: {
    readonly text: string;
    readonly index: number;
    readonly state: StructuralScanState;
    readonly visitTopLevelCharacter: (index: number) => number | void;
  },
): number | undefined {
  if (shouldSkipStructuralCharacter(input.text, input.index, input.state)) {
    return undefined;
  }

  if (consumeStructuralDepth(input.text[input.index] ?? '', input.state)) {
    return undefined;
  }

  if (input.state.depth !== 0) {
    return undefined;
  }

  const nextIndex = input.visitTopLevelCharacter(input.index);

  return typeof nextIndex === 'number' ? nextIndex : undefined;
}

function getCloseParenMatchIndex(
  text: string,
  index: number,
  state: StructuralScanState,
): number | undefined {
  if (shouldSkipStructuralCharacter(text, index, state)) {
    return undefined;
  }

  const character = text[index] ?? '';

  if (character === '(') {
    state.depth += 1;
    return undefined;
  }

  if (character !== ')') {
    return undefined;
  }

  state.depth -= 1;
  return state.depth === 0 ? index : undefined;
}

function createStructuralScanState(): StructuralScanState {
  return {
    depth: 0,
    inString: false,
    inComment: false,
  };
}

function shouldSkipStructuralCharacter(
  text: string,
  index: number,
  state: StructuralScanState,
): boolean {
  const character = text[index] ?? '';

  if (state.inComment) {
    if (character === '\n') {
      state.inComment = false;
    }

    return true;
  }

  if (isUnescapedQuote(text, index)) {
    state.inString = !state.inString;
    return true;
  }

  if (state.inString) {
    return true;
  }

  if (character !== '%') {
    return false;
  }

  state.inComment = true;
  return true;
}

function consumeStructuralDepth(character: string, state: StructuralScanState): boolean {
  if (character === '(') {
    state.depth += 1;
    return true;
  }

  if (character !== ')') {
    return false;
  }

  state.depth = Math.max(0, state.depth - 1);
  return true;
}

function isUnescapedQuote(text: string, index: number): boolean {
  return text[index] === '"' && text[index - 1] !== '\\';
}

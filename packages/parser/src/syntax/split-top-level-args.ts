interface SplitTopLevelArgsState {
  readonly args: string[];
  depth: number;
  inString: boolean;
  current: string;
}

/** Split a comma-separated argument list while respecting nesting and quoted strings. */
export function splitTopLevelArgs(text: string): string[] {
  const state: SplitTopLevelArgsState = {
    args: [],
    depth: 0,
    inString: false,
    current: '',
  };

  for (let index = 0; index < text.length; index += 1) {
    processArgumentCharacter(state, text, index);
  }

  pushTrimmedArg(state.args, state.current);

  return state.args;
}

function processArgumentCharacter(state: SplitTopLevelArgsState, text: string, index: number): void {
  const character = text[index] ?? '';

  if (isUnescapedQuote(text, index)) {
    state.inString = !state.inString;
  }

  if (state.inString) {
    state.current += character;
    return;
  }

  state.depth = updateDepth(state.depth, character);

  if (isTopLevelSeparator(character, state.depth)) {
    pushTrimmedArg(state.args, state.current);
    state.current = '';
    return;
  }

  state.current += character;
}

function isUnescapedQuote(text: string, index: number): boolean {
  return text[index] === '"' && text[index - 1] !== '\\';
}

function updateDepth(depth: number, character: string): number {
  if (character === '(') {
    return depth + 1;
  }

  if (character === ')') {
    return depth - 1;
  }

  return depth;
}

function isTopLevelSeparator(character: string, depth: number): boolean {
  return character === ',' && depth === 0;
}

function pushTrimmedArg(args: string[], current: string): void {
  const trimmed = current.trim();

  if (trimmed.length > 0) {
    args.push(trimmed);
  }
}

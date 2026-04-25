export interface SourceSpan {
  readonly startOffset: number;
  readonly endOffset: number;
}

/** Collect inline `%` comment spans while respecting quoted strings. */
export function collectCommentSpans(source: string): SourceSpan[] {
  const commentSpans: SourceSpan[] = [];
  let inString = false;
  let commentStart: number | null = null;

  for (let index = 0; index < source.length; index += 1) {
    ({ commentStart, inString } = scanCommentCharacter({
      source,
      index,
      commentSpans,
      commentStart,
      inString,
    }));
  }

  if (commentStart !== null) {
    commentSpans.push({ startOffset: commentStart, endOffset: source.length });
  }

  return commentSpans;
}

function scanCommentCharacter(options: {
  readonly source: string;
  readonly index: number;
  readonly commentSpans: SourceSpan[];
  readonly commentStart: number | null;
  readonly inString: boolean;
}): { readonly commentStart: number | null; readonly inString: boolean } {
  const character = options.source[options.index] ?? '';
  if (options.commentStart !== null) {
    if (character !== '\n') {
      return { commentStart: options.commentStart, inString: options.inString };
    }

    options.commentSpans.push({ startOffset: options.commentStart, endOffset: options.index });
    return { commentStart: null, inString: options.inString };
  }

  if (isUnescapedQuote(options.source, options.index)) {
    return { commentStart: null, inString: !options.inString };
  }

  return {
    commentStart: !options.inString && character === '%' ? options.index : null,
    inString: options.inString,
  };
}

function isUnescapedQuote(text: string, index: number): boolean {
  return text[index] === '"' && text[index - 1] !== '\\';
}

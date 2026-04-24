/**
 * A zero-based line/character source position.
 *
 * `character` counts UTF-16 code units so the contract aligns with the Language Server Protocol.
 */
export interface Position {
  readonly line: number;
  readonly character: number;
}

/**
 * A source span with zero-based UTF-16 positions.
 *
 * `start` is inclusive and `end` is exclusive.
 */
export interface Range {
  readonly start: Position;
  readonly end: Position;
}

/**
 * Optional source metadata for AST nodes.
 *
 * Offsets are zero-based UTF-16 code unit offsets. When a `range` is present, its positions use
 * the same zero-based UTF-16 convention for LSP compatibility.
 */
export interface DatalogSourceLocation {
  readonly sourceName?: string;
  readonly startOffset?: number;
  readonly endOffset?: number;
  readonly range?: Range;
}

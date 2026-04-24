export interface ParseContext {
  readonly source: string;
  readonly lineStarts: readonly number[];
}

export interface SourceSlice {
  readonly startOffset: number;
  readonly endOffset: number;
}

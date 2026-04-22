/** Domain error raised when a graph operation cannot be translated into SQL. */
export class GraphTranslationError extends Error {
  override readonly cause?: unknown;

  constructor(
    readonly code: string,
    message: string,
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'GraphTranslationError';
    this.cause = options?.cause;
  }
}

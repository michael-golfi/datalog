/** Extract unique `field=` names from a compound fact or projection argument list. */
export function extractCompoundFields(text: string): string[] {
  const fields = new Set<string>();
  const fieldPattern = /([a-z][a-z0-9_/-]*)=/g;
  let match: RegExpExecArray | null;

  while ((match = fieldPattern.exec(text)) !== null) {
    const field = match[1];

    if (field !== undefined) {
      fields.add(field);
    }
  }

  return [...fields];
}

import type { DatalogTerm, ScalarDomain } from '@datalog/ast';

/** Check whether a parsed term can satisfy a compound field scalar domain. */
export function isTermCompatibleWithDomain(term: DatalogTerm, domain: ScalarDomain): boolean {
  if (term.kind === 'variable' || term.kind === 'wildcard') {
    return true;
  }

  const valueKind = getConstantValueKind(term.value);
  if (valueKind === 'string') {
    return acceptsStringDomain(domain);
  }

  if (valueKind === 'number') {
    return domain === 'numeric' || (domain === 'int8' && Number.isInteger(term.value));
  }

  return valueKind === 'boolean' && domain === 'bool';
}

/** Describe a parsed term using the diagnostic-facing scalar-domain vocabulary. */
export function describeTermDomain(term: DatalogTerm): string {
  if (term.kind === 'variable') {
    return 'variable';
  }

  if (term.kind === 'wildcard') {
    return 'wildcard';
  }

  const valueKind = getConstantValueKind(term.value);
  if (valueKind === 'string') {
    return 'text';
  }

  if (valueKind === 'number') {
    return Number.isInteger(term.value) ? 'int8' : 'numeric';
  }

  return valueKind === 'boolean' ? 'bool' : 'null';
}

function acceptsStringDomain(domain: ScalarDomain): boolean {
  return (
    domain === 'node' ||
    domain === 'text' ||
    domain === 'jsonb' ||
    domain === 'date' ||
    domain === 'timestamp'
  );
}

function getConstantValueKind(
  value: string | number | boolean | null,
): 'string' | 'number' | 'boolean' | 'null' {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return 'string';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  return 'boolean';
}

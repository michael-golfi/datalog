import type { DatalogTraversableNodeKind } from './datalog-node.js';

export const DATALOG_VISITOR_KEYS = {
  program: ['statements'],
  fact: ['atom'],
  rule: ['head', 'body'],
  query: ['body'],
  directive: [],
  atom: ['terms'],
  named: ['term'],
  not: ['atom'],
  comparison: ['left', 'right'],
  function: ['args'],
  variable: [],
  constant: [],
  wildcard: [],
  vertex: ['id'],
  edge: ['subject', 'predicate', 'object'],
} as const satisfies Readonly<Record<DatalogTraversableNodeKind, readonly string[]>>;

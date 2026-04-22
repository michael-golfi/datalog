import type { ParsedReferenceRole } from '../contracts/parsed-document.js';

import { GRAPH_META_NODE_IDS } from './graph-vocabulary.js';

/** Classify the semantic role of a quoted string reference inside a clause. */
export function classifyReferenceRole(
  predicate: string,
  index: number,
  value: string,
): ParsedReferenceRole {
  if (predicate === 'DefPred') {
    return index === 0 ? 'graph-predicate' : 'label';
  }

  if (predicate === 'Edge') {
    if (index === 1) {
      return 'graph-predicate';
    }

    if (index === 2 && GRAPH_META_NODE_IDS.has(value)) {
      return 'node-id';
    }
  }

  return value.includes('/') ? 'node-id' : 'label';
}

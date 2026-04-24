import type {
  DatalogLanguageNode,
} from './datalog-language.js';
import type {
  DatalogFact,
  DatalogFactPattern,
} from './datalog-graph.js';

export type DatalogNode = DatalogLanguageNode | DatalogFact | DatalogFactPattern;

export type DatalogNodeKind = DatalogNode['kind'];

/**
 * Node kinds that can be traversed structurally through child-node visitor metadata.
 *
 * Concrete graph facts intentionally stay out of this union because they share `vertex`/`edge`
 * discriminants with graph fact patterns but expose scalar properties instead of child AST nodes.
 */
export type DatalogTraversableNode = DatalogLanguageNode | DatalogFactPattern;

export type DatalogTraversableNodeKind = DatalogTraversableNode['kind'];

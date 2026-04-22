import type { NodeSummary } from '../contracts/parsed-document.js';
import type { Range } from '../contracts/position.js';

interface NodeSummaryInput {
  readonly id: string;
  readonly range: Range;
  readonly classes: readonly string[];
  readonly label?: string;
}

interface GraphClassNodeSummaryInput {
  readonly id: string;
  readonly range: Range;
  readonly classes: readonly string[];
  readonly label?: string;
}

/** Create a node summary while omitting the optional label when absent. */
export function createNodeSummary(input: NodeSummaryInput): NodeSummary {
  if (input.label === undefined) {
    return {
      id: input.id,
      classes: input.classes,
      range: input.range,
    };
  }

  return {
    id: input.id,
    label: input.label,
    classes: input.classes,
    range: input.range,
  };
}

/** Build summary input with an optional label only when one is present. */
export function createGraphClassNodeSummaryInput(input: GraphClassNodeSummaryInput): NodeSummaryInput {
  return {
    id: input.id,
    range: input.range,
    classes: input.classes,
    ...(input.label === undefined ? {} : { label: input.label }),
  };
}

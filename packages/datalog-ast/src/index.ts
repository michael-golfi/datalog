export type {
  DatalogSourceLocation,
  Position,
  Range,
} from './datalog-source-span.js';

export type {
  DatalogAnnotationValue,
  DatalogAtom,
  DatalogAtomArgument,
  DatalogComparison,
  DatalogComparisonOperator,
  DatalogConstantTerm,
  DatalogDirectiveStatement,
  DatalogFactStatement,
  DatalogFunctionCall,
  DatalogLiteral,
  DatalogLanguageNode,
  DatalogLiteralConjunction,
  DatalogNamedTerm,
  DatalogNegatedAtom,
  DatalogPredicateName,
  DatalogProgram,
  DatalogQueryId,
  DatalogQueryStatement,
  DatalogRuleId,
  DatalogRuleStatement,
  DatalogScalarValue,
  DatalogStatement,
  DatalogTerm,
  DatalogTypeName,
  DatalogVariableName,
  DatalogVariableTerm,
  DatalogWildcardTerm,
} from './datalog-language.js';

export type {
  DatalogFact,
  DatalogFactPattern,
  DatalogFactPatternMatch,
  DatalogFactSet,
  EdgeFact,
  EdgeFactPattern,
  VertexFact,
  VertexFactPattern,
} from './datalog-graph.js';

export type {
  DatalogNode,
  DatalogNodeKind,
  DatalogTraversableNode,
  DatalogTraversableNodeKind,
} from './datalog-node.js';

export {
  atom,
  comparison,
  constantTerm,
  directiveStatement,
  factStatement,
  functionCall,
  namedTerm,
  negatedAtom,
  position,
  program,
  queryStatement,
  range,
  ruleStatement,
  sourceLocation,
  variableTerm,
  wildcardTerm,
} from './datalog-builders.js';

export {
  edgeFact,
  edgeFactPattern,
  factPatternMatch,
  factSet,
  vertexFact,
  vertexFactPattern,
} from './datalog-graph-builders.js';

export {
  isDatalogFact,
  isDatalogFactPattern,
  isEdgeFact,
  isEdgeFactPattern,
  isVertexFact,
  isVertexFactPattern,
} from './datalog-graph-type-guards.js';

export {
  isDatalogAtom,
  isDatalogAtomArgument,
  isDatalogComparison,
  isDatalogConstantTerm,
  isDatalogDirectiveStatement,
  isDatalogFactStatement,
  isDatalogFunctionCall,
  isDatalogLiteral,
  isDatalogNamedTerm,
  isDatalogNegatedAtom,
  isDatalogProgram,
  isDatalogQueryStatement,
  isDatalogRuleStatement,
  isDatalogSourceLocation,
  isDatalogStatement,
  isDatalogTerm,
  isDatalogVariableTerm,
  isDatalogWildcardTerm,
  isPosition,
  isRange,
} from './datalog-type-guards.js';

export {
  DATALOG_VISITOR_KEYS,
} from './datalog-visitor-keys.js';

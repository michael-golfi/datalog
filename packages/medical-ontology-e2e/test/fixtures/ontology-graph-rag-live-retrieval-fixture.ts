import { defPredSchema } from '@datalog/ast';
import {
  applyDatalogFacts,
  buildPredicateCatalogFromSchema,
  createSelectFactsOperationFromDatalogQuery,
} from '@datalog/datalog-to-sql';
import { parseDatalogQuery } from '@datalog/parser';

import {
  sortEvidenceRecords,
  type GraphRagEvidence,
  type GraphRagEvidenceType,
} from './ontology-graph-rag-evidence-fixture.js';
import {
  createOntologyLivePostgresProofFixture,
  executeOntologyGraphQuery,
  type OntologyLivePostgresProofFixture,
} from './ontology-live-postgres-proof-fixture.js';
import { extractOntologyFactsFromSource } from './ontology-migration-fact-extraction-fixture.js';

import type { GraphRagScenario } from './ontology-graph-rag-scenarios-fixture.js';

type GraphRagRetrievableEvidenceType = Exclude<GraphRagEvidenceType, 'label'>;

type ValueSource =
  | {
      readonly kind: 'column';
      readonly column: keyof LiveGraphRagEvidenceRow;
    }
  | {
      readonly kind: 'static';
      readonly value: string;
    };

type EvidenceIdSource =
  | ValueSource
  | {
      readonly kind: 'membership';
    };

interface LiveGraphRagEvidenceRow extends Record<string, unknown> {
  readonly evidence_id?: string;
  readonly object_id?: string;
  readonly object_label?: string;
  readonly subject_id?: string;
  readonly subject_label?: string;
}

interface LiveGraphRagEvidenceQuerySpec {
  readonly evidenceIdSource: EvidenceIdSource;
  readonly evidenceType: GraphRagRetrievableEvidenceType;
  readonly objectIdSource: ValueSource;
  readonly predicateId: string;
  readonly querySource: string;
  readonly relationshipKind?: string;
  readonly subjectIdSource: ValueSource;
}

export interface GraphRagLiveNormalizedEvidence {
  readonly appliedOverlayFacts: readonly string[];
  readonly evidence: readonly GraphRagEvidence[];
  readonly question: string;
  readonly retrievedEvidenceIds: ReadonlySet<string>;
  readonly scenarioId: string;
}

export interface RetrieveLiveGraphRagScenarioEvidenceInput {
  readonly livePostgresFixture: OntologyLivePostgresProofFixture;
  readonly overlayDatalogFacts?: readonly string[];
  readonly scenario: GraphRagScenario;
}

export interface OntologyGraphRagLiveRetrievalFixture extends OntologyLivePostgresProofFixture {
  retrieveScenarioEvidence(
    input: Omit<RetrieveLiveGraphRagScenarioEvidenceInput, 'livePostgresFixture'>,
  ): Promise<GraphRagLiveNormalizedEvidence>;
}

const COLUMN_EVIDENCE_ID = createColumnSource('evidence_id');
const GRAPH_QUERY_PREDICATE_CATALOG = buildPredicateCatalogFromSchema([
  defPredSchema({
    predicateName: 'Edge',
    subjectCardinality: '*',
    subjectDomain: 'node',
    objectCardinality: '*',
    objectDomain: 'node',
  }),
  defPredSchema({
    predicateName: 'Vertex',
    subjectCardinality: '*',
    subjectDomain: 'node',
    objectCardinality: '*',
    objectDomain: 'node',
  }),
  defPredSchema({
    predicateName: 'Node',
    subjectCardinality: '*',
    subjectDomain: 'node',
    objectCardinality: '*',
    objectDomain: 'node',
  }),
]);

const pregnancyLisinoprilHypertensionQuerySpecs = [
  createEvidenceNodeSpec({
    evidenceType: 'indication',
    predicateId: 'clinical/indication',
    relationshipKind: 'indication',
    subjectId: 'medication/lisinopril',
    objectId: 'condition/hypertension',
    subjectEdgePredicate: 'clinical/medication',
    objectEdgePredicate: 'clinical/condition',
  }),
  createEvidenceNodeSpec({
    evidenceType: 'contraindication',
    predicateId: 'clinical/contraindication',
    relationshipKind: 'contraindication',
    subjectId: 'medication/lisinopril',
    objectId: 'condition/pregnancy',
    subjectEdgePredicate: 'clinical/medication',
    objectEdgePredicate: 'clinical/condition',
  }),
  createMembershipSpec({
    subjectId: 'medication/lisinopril',
    objectId: 'drug_class/ace_inhibitor',
  }),
  createMappingSpec('medication/lisinopril'),
  createMappingSpec('condition/hypertension'),
  createMappingSpec('condition/pregnancy'),
] as const satisfies readonly LiveGraphRagEvidenceQuerySpec[];

const ckdHeartFailureIbuprofenQuerySpecs = [
  createEvidenceNodeSpec({
    evidenceType: 'contraindication',
    predicateId: 'clinical/contraindication',
    relationshipKind: 'contraindication',
    subjectId: 'medication/ibuprofen',
    objectId: 'condition/chronic_kidney_disease',
    subjectEdgePredicate: 'clinical/medication',
    objectEdgePredicate: 'clinical/condition',
  }),
  createEvidenceNodeSpec({
    evidenceType: 'contraindication',
    predicateId: 'clinical/contraindication',
    relationshipKind: 'contraindication',
    subjectId: 'medication/ibuprofen',
    objectId: 'condition/heart_failure',
    subjectEdgePredicate: 'clinical/medication',
    objectEdgePredicate: 'clinical/condition',
  }),
  createEvidenceNodeSpec({
    evidenceType: 'comorbidity',
    predicateId: 'clinical/comorbid_with',
    relationshipKind: 'comorbid_with',
    subjectId: 'condition/chronic_kidney_disease',
    objectId: 'condition/heart_failure',
    subjectEdgePredicate: 'clinical/condition_a',
    objectEdgePredicate: 'clinical/condition_b',
  }),
  createMembershipSpec({
    subjectId: 'medication/ibuprofen',
    objectId: 'drug_class/nsaid',
  }),
  createMappingSpec('medication/ibuprofen'),
  createMappingSpec('condition/chronic_kidney_disease'),
  createMappingSpec('condition/heart_failure'),
] as const satisfies readonly LiveGraphRagEvidenceQuerySpec[];

const atrialFibrillationAlternativesQuerySpecs = [
  createEvidenceNodeSpec({
    evidenceType: 'indication',
    predicateId: 'clinical/indication',
    relationshipKind: 'indication',
    subjectId: 'medication/warfarin',
    objectId: 'condition/atrial_fibrillation',
    subjectEdgePredicate: 'clinical/medication',
    objectEdgePredicate: 'clinical/condition',
  }),
  createEvidenceNodeSpec({
    evidenceType: 'indication',
    predicateId: 'clinical/indication',
    relationshipKind: 'indication',
    subjectId: 'medication/apixaban',
    objectId: 'condition/atrial_fibrillation',
    subjectEdgePredicate: 'clinical/medication',
    objectEdgePredicate: 'clinical/condition',
  }),
  createMembershipSpec({
    subjectId: 'medication/warfarin',
    objectId: 'drug_class/vitamin_k_antagonist',
  }),
  createMembershipSpec({
    subjectId: 'medication/apixaban',
    objectId: 'drug_class/factor_xa_inhibitor',
  }),
  createMappingSpec('medication/warfarin'),
  createMappingSpec('medication/apixaban'),
  createMappingSpec('condition/atrial_fibrillation'),
] as const satisfies readonly LiveGraphRagEvidenceQuerySpec[];

const SCENARIO_QUERY_SPECS: Readonly<Record<string, readonly LiveGraphRagEvidenceQuerySpec[]>> = {
  'atrial-fibrillation-anticoagulant-alternatives': atrialFibrillationAlternativesQuerySpecs,
  'ckd-heart-failure-ibuprofen': ckdHeartFailureIbuprofenQuerySpecs,
  'pregnancy-lisinopril-hypertension': pregnancyLisinoprilHypertensionQuerySpecs,
};

export async function createOntologyGraphRagLiveRetrievalFixture(): Promise<OntologyGraphRagLiveRetrievalFixture> {
  const livePostgresFixture = await createOntologyLivePostgresProofFixture();

  return {
    ...livePostgresFixture,
    retrieveScenarioEvidence: async (input) => retrieveLiveGraphRagScenarioEvidence({
      ...input,
      livePostgresFixture,
    }),
  };
}

export async function retrieveLiveGraphRagScenarioEvidence(
  input: RetrieveLiveGraphRagScenarioEvidenceInput,
): Promise<GraphRagLiveNormalizedEvidence> {
  const querySpecs = getScenarioQuerySpecs(input.scenario.scenarioId);
  const overlayFacts = collectOverlayFacts(input);
  const { sql } = input.livePostgresFixture;
  const rollbackAfterRead = overlayFacts.length > 0;

  await sql.unsafe('BEGIN');

  try {
    await applyOverlayFacts({
      livePostgresFixture: input.livePostgresFixture,
      overlayFacts,
      scenarioId: input.scenario.scenarioId,
    });

    const evidenceMap = new Map<string, GraphRagEvidence>();

    for (const spec of querySpecs) {
      const rows = await executeOntologyGraphQuery<LiveGraphRagEvidenceRow>(
        sql,
        createSelectFactsOperationFromDatalogQuery(parseDatalogQuery(spec.querySource), GRAPH_QUERY_PREDICATE_CATALOG),
      );

      for (const row of rows) {
        const evidence = normalizeEvidenceRow(spec, row);
        evidenceMap.set(evidence.evidenceId, evidence);
      }
    }

    const evidence = sortEvidenceRecords([...evidenceMap.values()]);

    if (rollbackAfterRead) {
      await sql.unsafe('ROLLBACK');
    } else {
      await sql.unsafe('COMMIT');
    }

    return {
      appliedOverlayFacts: overlayFacts,
      evidence,
      question: input.scenario.question,
      retrievedEvidenceIds: new Set(evidence.map((record) => record.evidenceId)),
      scenarioId: input.scenario.scenarioId,
    };
  } catch (error) {
    await sql.unsafe('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

function collectOverlayFacts(input: RetrieveLiveGraphRagScenarioEvidenceInput): readonly string[] {
  return [
    ...(input.scenario.liveTestSeedOverlay?.datalogFacts ?? []),
    ...(input.overlayDatalogFacts ?? []),
  ];
}

async function applyOverlayFacts(input: {
  readonly livePostgresFixture: OntologyLivePostgresProofFixture;
  readonly overlayFacts: readonly string[];
  readonly scenarioId: string;
}): Promise<void> {
  if (input.overlayFacts.length === 0) {
    return;
  }

  const extractedFacts = extractOntologyFactsFromSource(input.overlayFacts.join('\n')).facts;
  const [firstFact, ...remainingFacts] = extractedFacts;

  if (firstFact === undefined) {
    throw new Error(`Expected live GraphRAG overlay facts for scenario ${input.scenarioId} to produce graph facts.`);
  }

  await applyDatalogFacts({
    sql: input.livePostgresFixture.sql,
    mode: 'insert-facts',
    facts: [firstFact, ...remainingFacts],
  });
}

function normalizeEvidenceRow(
  spec: LiveGraphRagEvidenceQuerySpec,
  row: LiveGraphRagEvidenceRow,
): GraphRagEvidence {
  const evidenceId = resolveEvidenceId(spec, row);
  const objectLabel = getOptionalText(row.object_label);
  const relationshipKind = spec.relationshipKind;
  const subjectLabel = getOptionalText(row.subject_label);

  return {
    evidenceId,
    evidenceType: spec.evidenceType,
    objectId: resolveValue(spec.objectIdSource, row, 'object id'),
    predicateId: spec.predicateId,
    subjectId: resolveValue(spec.subjectIdSource, row, 'subject id'),
    ...(objectLabel === undefined ? {} : { objectLabel }),
    ...(relationshipKind === undefined ? {} : { relationshipKind }),
    ...(subjectLabel === undefined ? {} : { subjectLabel }),
  };
}

function resolveEvidenceId(spec: LiveGraphRagEvidenceQuerySpec, row: LiveGraphRagEvidenceRow): string {
  if (spec.evidenceIdSource.kind === 'membership') {
    return createMembershipEvidenceId({
      subjectId: resolveValue(spec.subjectIdSource, row, 'membership subject id'),
      objectId: resolveValue(spec.objectIdSource, row, 'membership object id'),
    });
  }

  return resolveValue(spec.evidenceIdSource, row, 'evidence id');
}

function resolveValue(source: ValueSource, row: LiveGraphRagEvidenceRow, description: string): string {
  if (source.kind === 'static') {
    return source.value;
  }

  const value = row[source.column];

  if (typeof value !== 'string') {
    throw new Error(`Expected live GraphRAG ${description} column ${source.column} to be a string.`);
  }

  return value;
}

function getOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function createMembershipEvidenceId(input: {
  readonly objectId: string;
  readonly subjectId: string;
}): string {
  return `membership/${getGraphIdTail(input.subjectId)}/${getGraphIdTail(input.objectId)}`;
}

function getGraphIdTail(graphId: string): string {
  const tail = graphId.split('/').at(-1);

  if (tail === undefined || tail.length === 0) {
    throw new Error(`Expected graph id ${graphId} to contain a trailing segment.`);
  }

  return tail;
}

function getScenarioQuerySpecs(scenarioId: string): readonly LiveGraphRagEvidenceQuerySpec[] {
  const specs = SCENARIO_QUERY_SPECS[scenarioId];

  if (specs === undefined) {
    throw new Error(`Unsupported GraphRAG live retrieval scenario: ${scenarioId}`);
  }

  return specs;
}

function createEvidenceNodeSpec(input: {
  readonly evidenceType: GraphRagRetrievableEvidenceType;
  readonly objectEdgePredicate: string;
  readonly objectId: string;
  readonly predicateId: string;
  readonly relationshipKind?: string;
  readonly subjectEdgePredicate: string;
  readonly subjectId: string;
}): LiveGraphRagEvidenceQuerySpec {
  const relationshipKind = input.relationshipKind;

  return {
    evidenceIdSource: COLUMN_EVIDENCE_ID,
    evidenceType: input.evidenceType,
    objectIdSource: createStaticSource(input.objectId),
    predicateId: input.predicateId,
    querySource: [
      `Edge(evidence_id, "${input.subjectEdgePredicate}", "${input.subjectId}")`,
      `Edge(evidence_id, "${input.objectEdgePredicate}", "${input.objectId}")`,
      `Edge("${input.subjectId}", "onto/preferred_label", subject_label)`,
      `Edge("${input.objectId}", "onto/preferred_label", object_label).`,
    ].join(',\n'),
    subjectIdSource: createStaticSource(input.subjectId),
    ...(relationshipKind === undefined ? {} : { relationshipKind }),
  };
}

function createMembershipSpec(input: {
  readonly objectId: string;
  readonly subjectId: string;
}): LiveGraphRagEvidenceQuerySpec {
  return {
    evidenceIdSource: {
      kind: 'membership',
    },
    evidenceType: 'drug_class',
    objectIdSource: createStaticSource(input.objectId),
    predicateId: 'med/has_drug_class',
    querySource: [
      `Edge("${input.subjectId}", "med/has_drug_class", "${input.objectId}")`,
      `Edge("${input.subjectId}", "onto/preferred_label", subject_label)`,
      `Edge("${input.objectId}", "onto/preferred_label", object_label).`,
    ].join(',\n'),
    relationshipKind: 'class_membership',
    subjectIdSource: createStaticSource(input.subjectId),
  };
}

function createMappingSpec(subjectId: string): LiveGraphRagEvidenceQuerySpec {
  return {
    evidenceIdSource: COLUMN_EVIDENCE_ID,
    evidenceType: 'mapping',
    objectIdSource: COLUMN_EVIDENCE_ID,
    predicateId: 'med/has_mapping',
    querySource: [
      `Edge("${subjectId}", "med/has_mapping", evidence_id)`,
      `Edge("${subjectId}", "onto/preferred_label", subject_label)`,
      'Edge(evidence_id, "onto/preferred_label", object_label).',
    ].join(',\n'),
    subjectIdSource: createStaticSource(subjectId),
  };
}

function createStaticSource(value: string): ValueSource {
  return {
    kind: 'static',
    value,
  };
}

function createColumnSource(column: keyof LiveGraphRagEvidenceRow): ValueSource {
  return {
    kind: 'column',
    column,
  };
}

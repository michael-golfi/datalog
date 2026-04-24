export type GraphRagEvidenceType =
  | 'indication'
  | 'contraindication'
  | 'comorbidity'
  | 'drug_class'
  | 'mapping'
  | 'label';

export interface GraphRagEvidence {
  readonly evidenceId: string;
  readonly evidenceType: GraphRagEvidenceType;
  readonly subjectId: string;
  readonly predicateId: string;
  readonly objectId: string;
  readonly subjectLabel?: string;
  readonly objectLabel?: string;
  readonly relationshipKind?: string;
  readonly action?: string;
  readonly severity?: string;
  readonly evidenceSource?: string;
  readonly evidenceLevel?: string;
  readonly asOfDate?: string;
}

const EVIDENCE_TYPE_SORT_ORDER: Record<GraphRagEvidenceType, number> = {
  indication: 0,
  contraindication: 1,
  comorbidity: 2,
  drug_class: 3,
  mapping: 4,
  label: 5,
};

export function sortEvidenceRecords(
  records: readonly GraphRagEvidence[],
): readonly GraphRagEvidence[] {
  return [...records].sort((a, b) => {
    const typeA = EVIDENCE_TYPE_SORT_ORDER[a.evidenceType] ?? 99;
    const typeB = EVIDENCE_TYPE_SORT_ORDER[b.evidenceType] ?? 99;
    if (typeA !== typeB) {
      return typeA - typeB;
    }

    return a.evidenceId.localeCompare(b.evidenceId);
  });
}

export function classifyEvidenceId(evidenceId: string): GraphRagEvidenceType {
  if (evidenceId.startsWith('indication/')) {
    return 'indication';
  }

  if (evidenceId.startsWith('contraindication/')) {
    return 'contraindication';
  }

  if (evidenceId.startsWith('comorbidity/')) {
    return 'comorbidity';
  }

  if (evidenceId.startsWith('membership/')) {
    return 'drug_class';
  }

  if (evidenceId.startsWith('mapping/')) {
    return 'mapping';
  }

  return 'label';
}

export interface EvidenceValidationResult {
  readonly missingEvidenceIds: readonly string[];
  readonly isComplete: boolean;
}

export function validateRequiredEvidence(
  retrievedEvidence: readonly GraphRagEvidence[],
  requiredEvidenceIds: readonly string[],
): EvidenceValidationResult {
  const retrievedIds = new Set(retrievedEvidence.map((e) => e.evidenceId));
  const missing = requiredEvidenceIds.filter((id) => !retrievedIds.has(id));
  return {
    missingEvidenceIds: missing,
    isComplete: missing.length === 0,
  };
}

export function validateRequiredEntities(
  evidence: readonly GraphRagEvidence[],
  requiredEntityIds: readonly string[],
): { readonly missingEntityIds: readonly string[]; readonly isComplete: boolean } {
  const retrievedEntityIds = new Set<string>();
  for (const record of evidence) {
    retrievedEntityIds.add(record.subjectId);
    retrievedEntityIds.add(record.objectId);
  }

  const missing = requiredEntityIds.filter((id) => !retrievedEntityIds.has(id));
  return {
    missingEntityIds: missing,
    isComplete: missing.length === 0,
  };
}

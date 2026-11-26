export const STAGE_IDS = [
  'requirements',
  'architecture',
  'design-review',
  'impl-plan',
  'implementation',
  'code-review',
  'verification',
  'doc-sync',
  'pull-request',
] as const;

export type StageId = (typeof STAGE_IDS)[number];
export type GateId = 'requirements' | 'architecture' | 'plan' | 'doc-changes' | 'pr';

export interface GateDef {
  id: GateId;
  artifacts: string[];
}

export interface StageDef {
  id: StageId;
  title: string;
  gate?: GateDef;
}

/** Fixed SDLC order. A gate's artifacts are hashed when a human approves it. */
export const STAGE_DEFS: readonly StageDef[] = [
  { id: 'requirements', title: 'Requirements', gate: { id: 'requirements', artifacts: ['docs/requirements.md'] } },
  { id: 'architecture', title: 'Architecture' },
  {
    id: 'design-review',
    title: 'Design Review',
    gate: { id: 'architecture', artifacts: ['docs/architecture.md', 'docs/design-review.md'] },
  },
  { id: 'impl-plan', title: 'Implementation Planning', gate: { id: 'plan', artifacts: ['docs/impl-plan.md'] } },
  { id: 'implementation', title: 'Implementation' },
  { id: 'code-review', title: 'Code Review' },
  { id: 'verification', title: 'Verification' },
  {
    id: 'doc-sync',
    title: 'Documentation Sync',
    gate: { id: 'doc-changes', artifacts: ['docs/traceability-matrix.md'] },
  },
  {
    id: 'pull-request',
    title: 'Pull Request',
    gate: { id: 'pr', artifacts: ['docs/pr-description.md', 'docs/verification-report.md'] },
  },
];

export function isStageId(value: string): value is StageId {
  return (STAGE_IDS as readonly string[]).includes(value);
}

export function stageIndex(id: StageId): number {
  return STAGE_DEFS.findIndex((s) => s.id === id);
}

export function stageForGate(gate: string): StageDef | undefined {
  return STAGE_DEFS.find((s) => s.gate?.id === gate);
}

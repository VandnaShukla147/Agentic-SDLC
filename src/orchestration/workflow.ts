import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeResolve, sha256 } from '../documentation/fsSafe.js';
import { err, ok, type Result } from '../integrations/errors.js';
import { isValidStoryId } from '../integrations/validation.js';
import { ApprovalLedger, type Approval, type ArtifactHash, type Ledger } from './approvals.js';
import { AuditLog } from './auditLog.js';
import { STAGE_DEFS, isStageId, stageForGate, stageIndex, type GateId, type StageId } from './stages.js';
import { StateStore, type StageState, type WorkflowState } from './stateStore.js';

export interface ConfirmRequest {
  action: 'approve' | 'reject';
  gate: GateId;
  artifacts: string[];
}

/** Supplies the human decision. The CLI implementation requires an interactive terminal. */
export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

export interface WorkflowOptions {
  root: string;
  confirm: ConfirmFn;
  now?: () => Date;
  approver?: () => string;
  env?: NodeJS.ProcessEnv;
}

export interface WorkflowStatus {
  state: WorkflowState;
  approvals: Approval[];
  invalidated: GateId[];
}

export interface LedgerVerification {
  valid: GateId[];
  stale: { gate: GateId; path: string; reason: string }[];
}

interface Context {
  state: WorkflowState;
  ledger: Ledger;
  invalidated: GateId[];
}

const fail = (message: string) => err('WORKFLOW', message);

/** Enforces stage order, human approval gates and artifact-hash integrity. */
export class Workflow {
  private readonly root: string;
  private readonly confirm: ConfirmFn;
  private readonly now: () => Date;
  private readonly approver: () => string;
  private readonly store: StateStore;
  private readonly ledgerStore: ApprovalLedger;
  private readonly audit: AuditLog;

  constructor(options: WorkflowOptions) {
    this.root = options.root;
    this.confirm = options.confirm;
    this.now = options.now ?? (() => new Date());
    this.approver = options.approver ?? (() => os.userInfo().username);
    this.store = new StateStore(path.join(this.root, '.sdlc', 'state.json'));
    this.ledgerStore = new ApprovalLedger(path.join(this.root, 'docs', 'approvals.json'));
    this.audit = new AuditLog(path.join(this.root, '.sdlc', 'audit.jsonl'), options.env ?? process.env, this.now);
  }

  async start(storyId: string): Promise<Result<WorkflowState>> {
    if (!isValidStoryId(storyId)) return err('INVALID_ID', 'Story ID has an invalid format.', ['id']);
    const existing = await this.store.load();
    if (!existing.ok) return existing;
    if (existing.value) {
      return existing.value.storyId === storyId
        ? ok(existing.value)
        : fail(`A workflow is already active for ${existing.value.storyId}.`);
    }
    const timestamp = this.now().toISOString();
    const stages = {} as Record<StageId, StageState>;
    for (const def of STAGE_DEFS) {
      stages[def.id] = { status: def.id === 'requirements' ? 'in-progress' : 'pending', updatedAt: timestamp };
    }
    const state: WorkflowState = { schemaVersion: 1, storyId, startedAt: timestamp, stages };
    await this.store.save(state);
    await this.audit.append('workflow.started', { storyId });
    return ok(state);
  }

  async status(): Promise<Result<WorkflowStatus>> {
    const ctx = await this.context();
    if (!ctx.ok) return ctx;
    return ok({ state: ctx.value.state, approvals: ctx.value.ledger.approvals, invalidated: ctx.value.invalidated });
  }

  /** Records a human approval of the gate, bound to the SHA-256 of each artifact. */
  async approve(gate: string): Promise<Result<Approval>> {
    const def = stageForGate(gate);
    if (!def?.gate) return fail(`Unknown gate "${gate}".`);
    const ctx = await this.context();
    if (!ctx.ok) return ctx;
    if (ctx.value.state.stages[def.id].status !== 'in-progress') {
      return fail(`Gate "${gate}" cannot be approved while stage "${def.id}" is not in progress.`);
    }

    const hashes: ArtifactHash[] = [];
    for (const artifact of def.gate.artifacts) {
      const hash = await this.hashArtifact(artifact);
      if (hash === null) return fail(`Artifact missing for gate "${gate}": ${artifact}.`);
      hashes.push({ path: artifact, sha256: hash });
    }
    if (!(await this.confirm({ action: 'approve', gate: def.gate.id, artifacts: def.gate.artifacts }))) {
      return fail('Approval requires explicit interactive human confirmation.');
    }

    const approval: Approval = {
      gate: def.gate.id,
      storyId: ctx.value.state.storyId,
      artifacts: hashes,
      approver: this.approver(),
      timestamp: this.now().toISOString(),
    };
    ctx.value.ledger.approvals = [...ctx.value.ledger.approvals.filter((a) => a.gate !== approval.gate), approval];
    await this.ledgerStore.save(ctx.value.ledger);
    await this.audit.append('gate.approved', { gate: approval.gate, approver: approval.approver, artifacts: hashes });
    return ok(approval);
  }

  /** Revokes the gate (and all later gates) and reopens its stage. */
  async reject(gate: string, reason: string): Promise<Result<StageId>> {
    const def = stageForGate(gate);
    if (!def?.gate) return fail(`Unknown gate "${gate}".`);
    if (reason.trim().length === 0) return err('MISSING_FIELDS', 'A rejection reason is required.', ['reason']);
    const ctx = await this.context();
    if (!ctx.ok) return ctx;
    if (ctx.value.state.stages[def.id].status === 'pending') return fail(`Stage "${def.id}" has not been reached.`);
    if (!(await this.confirm({ action: 'reject', gate: def.gate.id, artifacts: def.gate.artifacts }))) {
      return fail('Rejection requires explicit interactive human confirmation.');
    }
    await this.resetFrom(ctx.value, stageIndex(def.id), `rejected: ${reason}`);
    await this.audit.append('gate.rejected', { gate: def.gate.id, approver: this.approver(), reason });
    return ok(def.id);
  }

  async complete(stageId: string, evidence: string): Promise<Result<StageId | null>> {
    if (!isStageId(stageId)) return fail(`Unknown stage "${stageId}".`);
    const ctx = await this.context();
    if (!ctx.ok) return ctx;
    const { state, ledger } = ctx.value;
    if (state.stages[stageId].status !== 'in-progress') return fail(`Stage "${stageId}" is not in progress.`);

    const def = STAGE_DEFS[stageIndex(stageId)];
    if (def?.gate && !ledger.approvals.some((a) => a.gate === def.gate?.id)) {
      return fail(`Gate "${def.gate.id}" must be approved by a human before completing "${stageId}".`);
    }
    const resolved = await safeResolve(this.root, evidence);
    if (!resolved.ok) return resolved;
    if (!(await stat(resolved.value).catch(() => null))?.isFile()) return fail(`Evidence file not found: ${evidence}.`);

    const timestamp = this.now().toISOString();
    state.stages[stageId] = { status: 'complete', evidence, updatedAt: timestamp };
    const next = STAGE_DEFS[stageIndex(stageId) + 1];
    if (next) state.stages[next.id] = { status: 'in-progress', updatedAt: timestamp };
    await this.store.save(state);
    await this.audit.append('stage.completed', { stage: stageId, evidence });
    return ok(next?.id ?? null);
  }

  /** Read-only check of the committed ledger; needs no local state (usable in CI). */
  async verifyLedger(): Promise<Result<LedgerVerification>> {
    const loaded = await this.ledgerStore.load();
    if (!loaded.ok) return loaded;
    const result: LedgerVerification = { valid: [], stale: [] };
    for (const approval of loaded.value.approvals) {
      const stale = await this.findStale(approval);
      if (stale) result.stale.push(stale);
      else result.valid.push(approval.gate);
    }
    return ok(result);
  }

  private async context(): Promise<Result<Context>> {
    const state = await this.store.load();
    if (!state.ok) return state;
    if (!state.value) return fail('No workflow has been started. Run "workflow start <STORY-ID>".');
    const ledger = await this.ledgerStore.load();
    if (!ledger.ok) return ledger;

    const ctx: Context = {
      state: state.value,
      ledger: { ...ledger.value, approvals: ledger.value.approvals.filter((a) => this.appliesTo(a, state.value?.storyId)) },
      invalidated: [],
    };
    for (const def of STAGE_DEFS) {
      const approval = def.gate && ctx.ledger.approvals.find((a) => a.gate === def.gate?.id);
      const stale = approval ? await this.findStale(approval) : null;
      if (stale) {
        await this.resetFrom(ctx, stageIndex(def.id), `artifact changed after approval: ${stale.path} (${stale.reason})`);
        break;
      }
    }
    return ok(ctx);
  }

  private async resetFrom(ctx: Context, index: number, reason: string): Promise<void> {
    const timestamp = this.now().toISOString();
    const revoked = new Set<GateId>();
    STAGE_DEFS.forEach((def, i) => {
      if (i < index) return;
      if (def.gate) revoked.add(def.gate.id);
      const status = i === index ? 'in-progress' : 'pending';
      if (ctx.state.stages[def.id].status !== 'pending' || i === index) {
        ctx.state.stages[def.id] = { status, ...(i === index ? { reason } : {}), updatedAt: timestamp };
      }
    });
    const removed = ctx.ledger.approvals.filter((a) => revoked.has(a.gate)).map((a) => a.gate);
    ctx.ledger.approvals = ctx.ledger.approvals.filter((a) => !revoked.has(a.gate));
    ctx.invalidated.push(...removed);
    await this.ledgerStore.save(ctx.ledger);
    await this.store.save(ctx.state);
    if (removed.length > 0) await this.audit.append('gate.invalidated', { gates: removed, reason });
  }

  /** An approval counts only for the current story and for exactly the gate's defined artifacts. */
  private appliesTo(approval: Approval, storyId: string | undefined): boolean {
    const gate = STAGE_DEFS.find((s) => s.gate?.id === approval.gate)?.gate;
    if (!gate || approval.storyId !== storyId) return false;
    const paths = approval.artifacts.map((a) => a.path).sort();
    return paths.length > 0 && JSON.stringify(paths) === JSON.stringify([...gate.artifacts].sort());
  }

  private async findStale(approval: Approval): Promise<{ gate: GateId; path: string; reason: string } | null> {
    for (const artifact of approval.artifacts) {
      const hash = await this.hashArtifact(artifact.path);
      if (hash === null) return { gate: approval.gate, path: artifact.path, reason: 'missing' };
      if (hash !== artifact.sha256) return { gate: approval.gate, path: artifact.path, reason: 'hash mismatch' };
    }
    return null;
  }

  private async hashArtifact(relativePath: string): Promise<string | null> {
    const resolved = await safeResolve(this.root, relativePath);
    if (!resolved.ok) return null;
    return readFile(resolved.value).then(sha256, () => null);
  }
}

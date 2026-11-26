import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkTraceability } from '../../src/documentation/docCheck.js';
import { Workflow, type ConfirmFn } from '../../src/orchestration/workflow.js';

let root: string;
const put = async (rel: string, content: string) => {
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await writeFile(path.join(root, rel), content, 'utf8');
};
const makeWorkflow = (confirm: ConfirmFn = async () => true) =>
  new Workflow({ root, confirm, approver: () => 'tester', env: {} });

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'docsync-wf-'));
  await put('docs/requirements.md', 'REQ-F-001 REQ-N-001');
  await put('docs/architecture.md', 'arch');
  await put('docs/design-review.md', 'review');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('workflow: human approval gates', () => {
  it('starts at requirements and does not allow skipping stages', async () => {
    const wf = makeWorkflow();
    expect(await wf.start('../x')).toMatchObject({ ok: false, error: { code: 'INVALID_ID' } });
    await wf.start('DEMO-101');
    expect(await wf.complete('architecture', 'docs/architecture.md')).toMatchObject({ ok: false });
  });

  it('cannot complete a gated stage until a human approves', async () => {
    const wf = makeWorkflow();
    await wf.start('DEMO-101');
    expect(await wf.complete('requirements', 'docs/requirements.md')).toMatchObject({ ok: false });
    expect((await wf.approve('requirements')).ok).toBe(true);
    const done = await wf.complete('requirements', 'docs/requirements.md');
    expect(done.ok && done.value).toBe('architecture');
  });

  it('records nothing when the human declines (e.g. no interactive terminal)', async () => {
    const confirm = vi.fn(async () => false);
    const wf = makeWorkflow(confirm);
    await wf.start('DEMO-101');
    expect(await wf.approve('requirements')).toMatchObject({ ok: false });
    const status = await wf.status();
    expect(status.ok && status.value.approvals).toEqual([]);
  });

  it('invalidates the approval when an approved artifact changes afterwards', async () => {
    const wf = makeWorkflow();
    await wf.start('DEMO-101');
    await wf.approve('requirements');
    await wf.complete('requirements', 'docs/requirements.md');
    await put('docs/requirements.md', 'edited after approval');

    const status = await wf.status();
    expect(status.ok && status.value.invalidated).toEqual(['requirements']);
    expect(status.ok && status.value.state.stages.requirements.status).toBe('in-progress');
    expect((await makeWorkflow().verifyLedger()).ok).toBe(true);
  });

  it('reuses no approval from another story or a doctored ledger (code-review finding)', async () => {
    const wf = makeWorkflow();
    await wf.start('DEMO-101');
    await wf.approve('requirements');
    await rm(path.join(root, '.sdlc'), { recursive: true });

    const other = makeWorkflow();
    await other.start('DEMO-102');
    expect(await other.complete('requirements', 'docs/requirements.md')).toMatchObject({ ok: false });
  });

  it('reject needs a reason and reopens the stage', async () => {
    const wf = makeWorkflow();
    await wf.start('DEMO-101');
    await wf.approve('requirements');
    expect(await wf.reject('requirements', ' ')).toMatchObject({ ok: false, error: { code: 'MISSING_FIELDS' } });
    expect((await wf.reject('requirements', 'needs NFRs')).ok).toBe(true);
    const status = await wf.status();
    expect(status.ok && status.value.approvals).toEqual([]);
  });
});

describe('docs check: requirements are traced in the matrix', () => {
  it('reports missing IDs, and passes when all are traced', async () => {
    await put('docs/traceability-matrix.md', 'REQ-F-001 only');
    const partial = await checkTraceability(root);
    expect(partial.ok && partial.value.missing).toEqual(['REQ-N-001']);
    await put('docs/traceability-matrix.md', 'REQ-F-001 REQ-N-001');
    expect((await checkTraceability(root)).ok && true).toBe(true);
    const full = await checkTraceability(root);
    expect(full.ok && full.value.missing).toEqual([]);
  });

  it('reports missing files', async () => {
    expect(await checkTraceability(root)).toMatchObject({ ok: false, error: { code: 'SOURCE_UNAVAILABLE' } });
  });
});

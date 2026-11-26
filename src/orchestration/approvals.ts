import { readFile } from 'node:fs/promises';
import { atomicWrite } from '../documentation/fsSafe.js';
import { err, ok, type Result } from '../integrations/errors.js';
import type { GateId } from './stages.js';

export interface ArtifactHash {
  path: string;
  sha256: string;
}

export interface Approval {
  gate: GateId;
  storyId: string;
  artifacts: ArtifactHash[];
  approver: string;
  timestamp: string;
}

export interface Ledger {
  schemaVersion: 1;
  approvals: Approval[];
}

/** Committed record of human approvals, bound to the SHA-256 of each approved artifact. */
export class ApprovalLedger {
  constructor(private readonly file: string) {}

  async load(): Promise<Result<Ledger>> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ok({ schemaVersion: 1, approvals: [] });
      return err('SOURCE_UNAVAILABLE', 'Approval ledger could not be read.');
    }
    try {
      const data = JSON.parse(text) as Partial<Ledger> | null;
      if (data?.schemaVersion !== 1 || !Array.isArray(data.approvals)) {
        return err('MALFORMED', 'Approval ledger has an unexpected structure.');
      }
      return ok({ schemaVersion: 1, approvals: data.approvals });
    } catch {
      return err('MALFORMED', 'Approval ledger is not valid JSON.');
    }
  }

  async save(ledger: Ledger): Promise<void> {
    await atomicWrite(this.file, `${JSON.stringify(ledger, null, 2)}\n`);
  }
}

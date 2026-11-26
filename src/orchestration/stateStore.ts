import { readFile } from 'node:fs/promises';
import { atomicWrite } from '../documentation/fsSafe.js';
import { err, ok, type Result } from '../integrations/errors.js';
import { STAGE_IDS, type StageId } from './stages.js';

export type StageStatus = 'pending' | 'in-progress' | 'complete';

export interface StageState {
  status: StageStatus;
  evidence?: string;
  reason?: string;
  updatedAt: string;
}

export interface WorkflowState {
  schemaVersion: 1;
  storyId: string;
  startedAt: string;
  stages: Record<StageId, StageState>;
}

export class StateStore {
  constructor(private readonly file: string) {}

  async load(): Promise<Result<WorkflowState | null>> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ok(null);
      return err('SOURCE_UNAVAILABLE', 'Workflow state could not be read.');
    }
    try {
      const data = JSON.parse(text) as Partial<WorkflowState> | null;
      const valid =
        data?.schemaVersion === 1 &&
        typeof data.storyId === 'string' &&
        STAGE_IDS.every((id) => typeof data.stages?.[id]?.status === 'string');
      return valid ? ok(data as WorkflowState) : err('MALFORMED', 'Workflow state has an unexpected structure.');
    } catch {
      return err('MALFORMED', 'Workflow state is not valid JSON.');
    }
  }

  async save(state: WorkflowState): Promise<void> {
    await atomicWrite(this.file, `${JSON.stringify(state, null, 2)}\n`);
  }
}

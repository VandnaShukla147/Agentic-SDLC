import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '../integrations/errors.js';

export interface DocCheckReport {
  requirements: string[];
  traced: string[];
  missing: string[];
}

const REQ_ID = /\bREQ-[A-Z]-\d{3}\b/g;

/** Verifies every requirement ID in docs/requirements.md is traced in docs/traceability-matrix.md. */
export async function checkTraceability(root: string): Promise<Result<DocCheckReport>> {
  const read = (rel: string) => readFile(path.join(root, rel), 'utf8').catch(() => null);
  const requirements = await read('docs/requirements.md');
  if (requirements === null) return err('SOURCE_UNAVAILABLE', 'docs/requirements.md is missing.');
  const matrix = await read('docs/traceability-matrix.md');
  if (matrix === null) return err('SOURCE_UNAVAILABLE', 'docs/traceability-matrix.md is missing.');

  const ids = [...new Set(requirements.match(REQ_ID) ?? [])].sort();
  if (ids.length === 0) return err('MALFORMED', 'docs/requirements.md contains no requirement IDs.');
  const inMatrix = new Set(matrix.match(REQ_ID) ?? []);
  return ok({
    requirements: ids,
    traced: ids.filter((id) => inMatrix.has(id)),
    missing: ids.filter((id) => !inMatrix.has(id)),
  });
}

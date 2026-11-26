import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { redact } from '../configuration/redact.js';

export interface AuditEvent {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface AuditReadResult {
  events: AuditEvent[];
  corruptLines: number;
}

/** Append-only JSONL audit trail. Secrets are redacted before writing. */
export class AuditLog {
  constructor(
    private readonly file: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async append(type: string, data: Record<string, unknown> = {}): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const line = redact(JSON.stringify({ ...data, type, timestamp: this.now().toISOString() }), this.env);
    // A crash can leave a partial last line; start a fresh line so new events stay parseable.
    const existing = await readFile(this.file, 'utf8').catch(() => '');
    const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    await appendFile(this.file, `${prefix}${line}\n`, 'utf8');
  }

  async read(): Promise<AuditReadResult> {
    const text = await readFile(this.file, 'utf8').catch(() => '');
    const events: AuditEvent[] = [];
    let corruptLines = 0;
    for (const line of text.split('\n')) {
      if (line.trim().length === 0) continue;
      try {
        const parsed: unknown = JSON.parse(line);
        if (typeof parsed === 'object' && parsed !== null && typeof (parsed as AuditEvent).type === 'string') {
          events.push(parsed as AuditEvent);
        } else {
          corruptLines++;
        }
      } catch {
        corruptLines++;
      }
    }
    return { events, corruptLines };
  }
}

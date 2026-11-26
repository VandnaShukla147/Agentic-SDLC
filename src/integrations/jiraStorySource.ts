import type { JiraConfig } from '../configuration/config.js';
import { err, type Result } from './errors.js';
import type { Story, StoryListing, UserStorySource } from './types.js';
import { isValidStoryId, normalizeStory } from './validation.js';

type FetchFn = typeof fetch;

/** Plain text of a Jira description, which may be Atlassian Document Format. */
function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return '';
  const node = value as { type?: string; text?: string; content?: unknown[] };
  if (node.type === 'hardBreak') return '\n';
  if (node.text !== undefined) return node.text;
  const children = (node.content ?? []).map(toText);
  // Block containers are separated by newlines; inline runs inside a paragraph stay on one line.
  const blocks = ['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote'];
  return children.join(blocks.includes(node.type ?? '') ? '\n' : '');
}

/** Splits "Acceptance Criteria" bullet lines out of a description. */
function splitCriteria(text: string): { description: string; criteria: string[] } {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /^\s*acceptance criteria:?\s*$/i.test(l));
  if (at === -1) return { description: text.trim(), criteria: [] };
  const criteria = lines
    .slice(at + 1)
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  return { description: lines.slice(0, at).join('\n').trim(), criteria };
}

/** Optional Jira source (REST v3). Failures are reported; it never falls back to demo data. */
export class JiraStorySource implements UserStorySource {
  readonly kind = 'jira' as const;

  constructor(
    private readonly config: JiraConfig,
    private readonly fetchImpl: FetchFn = fetch,
  ) {}

  async get(id: string): Promise<Result<Story>> {
    if (!isValidStoryId(id)) return err('INVALID_ID', 'Story ID has an invalid format.', ['id']);
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.baseUrl}/rest/api/3/issue/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return err('SOURCE_UNAVAILABLE', 'Jira could not be reached.');
    }
    if (response.status === 401 || response.status === 403) return err('AUTH_FAILED', 'Jira rejected the credentials.');
    if (response.status === 404) return err('NOT_FOUND', `Story ${id} was not found in Jira.`);
    if (!response.ok) return err('SOURCE_UNAVAILABLE', `Jira returned HTTP ${response.status}.`);

    let issue: { key?: string; fields?: Record<string, unknown> };
    try {
      issue = (await response.json()) as typeof issue;
    } catch {
      return err('MALFORMED', 'Jira response was not valid JSON.');
    }
    const fields = issue.fields ?? {};
    const parsed = splitCriteria(toText(fields['description']));
    const { description } = parsed;
    let { criteria } = parsed;
    const field = this.config.acceptanceCriteriaField;
    if (field && fields[field]) {
      criteria = toText(fields[field])
        .split('\n')
        .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
        .filter(Boolean);
    }
    const named = (v: unknown): string | undefined =>
      typeof (v as { name?: unknown } | null)?.name === 'string' ? (v as { name: string }).name : undefined;
    const parentKey = (fields['parent'] as { key?: unknown } | undefined)?.key;
    const raw: Record<string, unknown> = {
      id: issue.key,
      title: fields['summary'],
      description,
      acceptanceCriteria: criteria,
      type: named(fields['issuetype']),
      priority: named(fields['priority']),
      status: named(fields['status']),
      epicId: typeof parentKey === 'string' ? parentKey : undefined,
    };
    return normalizeStory(raw, 'jira');
  }

  async list(): Promise<Result<StoryListing>> {
    return err('SOURCE_UNAVAILABLE', 'Listing is not implemented for Jira; use "stories show <KEY>".');
  }
}

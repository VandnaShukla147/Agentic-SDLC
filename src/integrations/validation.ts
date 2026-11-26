import { err, ok, type Result } from './errors.js';
import type { Story, StorySourceKind } from './types.js';

const STORY_ID_PATTERN = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*-\d+$/;
const MAX_ID_LENGTH = 64;

export function isValidStoryId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= MAX_ID_LENGTH && STORY_ID_PATTERN.test(id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Validates a raw story record and normalizes it to the common Story shape. */
export function normalizeStory(raw: unknown, source: StorySourceKind): Result<Story> {
  if (!isRecord(raw)) {
    return err('MALFORMED', 'Story entry is not an object.');
  }

  const missing: string[] = [];
  if (!isNonEmptyString(raw['id'])) missing.push('id');
  if (!isNonEmptyString(raw['title'])) missing.push('title');
  if (!isNonEmptyString(raw['description'])) missing.push('description');
  const criteria = raw['acceptanceCriteria'];
  const criteriaValid =
    isStringArray(criteria) && criteria.length > 0 && criteria.every((c) => c.trim().length > 0);
  if (!criteriaValid) missing.push('acceptanceCriteria');
  if (missing.length > 0) {
    return err('MISSING_FIELDS', `Story is missing required fields: ${missing.join(', ')}.`, missing);
  }

  const id = raw['id'] as string;
  if (!isValidStoryId(id)) {
    return err('INVALID_ID', 'Story ID has an invalid format.', ['id']);
  }

  const malformed: string[] = [];
  const dependencies = raw['dependencies'] ?? [];
  if (!isStringArray(dependencies)) malformed.push('dependencies');
  const metadata = raw['metadata'] ?? {};
  if (!isRecord(metadata)) malformed.push('metadata');
  for (const key of ['type', 'priority', 'epicId', 'status']) {
    const value = raw[key];
    if (value !== undefined && typeof value !== 'string') malformed.push(key);
  }
  if (malformed.length > 0) {
    return err('MALFORMED', `Story has fields of the wrong type: ${malformed.join(', ')}.`, malformed);
  }

  const story: Story = {
    id,
    type: typeof raw['type'] === 'string' ? raw['type'] : 'Story',
    title: (raw['title'] as string).trim(),
    description: (raw['description'] as string).trim(),
    acceptanceCriteria: (criteria as string[]).map((c) => c.trim()),
    dependencies: [...(dependencies as string[])],
    metadata: { ...(metadata as Record<string, unknown>) },
    source,
  };
  if (typeof raw['priority'] === 'string') story.priority = raw['priority'];
  if (typeof raw['epicId'] === 'string') story.epicId = raw['epicId'];
  if (typeof raw['status'] === 'string') story.status = raw['status'];
  return ok(story);
}

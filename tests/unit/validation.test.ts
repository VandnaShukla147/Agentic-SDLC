import { describe, expect, it } from 'vitest';
import { isValidStoryId, normalizeStory } from '../../src/integrations/validation.js';

const valid = {
  id: 'DEMO-101',
  title: 'Title',
  description: 'Desc',
  acceptanceCriteria: ['one', 'two'],
};

describe('isValidStoryId', () => {
  it.each(['DEMO-101', 'DEMO-EPIC-001', 'ABC-1'])('accepts %s', (id) => {
    expect(isValidStoryId(id)).toBe(true);
  });

  it.each(['', 'demo-101', '../DEMO-101', 'DEMO-101 ', 'DEMO', 'DEMO-101\\x', 'A'.repeat(70) + '-1', 42, null])(
    'rejects %s',
    (id) => {
      expect(isValidStoryId(id)).toBe(false);
    },
  );
});

describe('normalizeStory', () => {
  it('normalizes a valid story, applies defaults and records the source', () => {
    const result = normalizeStory(valid, 'demo');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ source: 'demo', dependencies: [], metadata: {}, type: 'Story' });
    }
  });

  it.each(['id', 'title', 'description', 'acceptanceCriteria'])('reports missing %s by name', (field) => {
    const raw: Record<string, unknown> = { ...valid };
    delete raw[field];
    const result = normalizeStory(raw, 'demo');
    expect(result).toMatchObject({ ok: false, error: { code: 'MISSING_FIELDS', fields: [field] } });
  });

  it('treats empty acceptance criteria and blank strings as missing', () => {
    const result = normalizeStory({ ...valid, title: '  ', acceptanceCriteria: [] }, 'demo');
    expect(result).toMatchObject({ ok: false, error: { fields: ['title', 'acceptanceCriteria'] } });
  });

  it('rejects an invalid ID format', () => {
    expect(normalizeStory({ ...valid, id: '../etc' }, 'demo')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_ID' },
    });
  });

  it.each([null, 'text', 42, [], undefined])('flags non-object entries as malformed (%s)', (raw) => {
    expect(normalizeStory(raw, 'demo')).toMatchObject({ ok: false, error: { code: 'MALFORMED' } });
  });

  it('flags wrongly typed optional fields as malformed', () => {
    const result = normalizeStory({ ...valid, dependencies: 'DEMO-100', priority: 5 }, 'demo');
    expect(result).toMatchObject({ ok: false, error: { code: 'MALFORMED', fields: ['dependencies', 'priority'] } });
  });
});

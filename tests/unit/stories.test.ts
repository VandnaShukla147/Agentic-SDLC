import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/configuration/config.js';
import { createStorySource } from '../../src/integrations/factory.js';
import { JiraStorySource } from '../../src/integrations/jiraStorySource.js';
import { LocalDemoStorySource } from '../../src/integrations/localDemoStorySource.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'docsync-stories-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function demoWith(content: string): Promise<LocalDemoStorySource> {
  const file = path.join(dir, 'stories.json');
  await writeFile(file, content, 'utf8');
  return new LocalDemoStorySource(file);
}

describe('demo story source (DEMO-101 acceptance criteria)', () => {
  const seed = new LocalDemoStorySource(path.resolve('demo/jira/stories.json'));

  it('retrieves a story by ID with its source recorded, without credentials', async () => {
    const result = await seed.get('DEMO-101');
    expect(result.ok && result.value).toMatchObject({ id: 'DEMO-101', source: 'demo' });
    expect(result.ok && result.value.acceptanceCriteria).toHaveLength(6);
  });

  it('lists the seed backlog', async () => {
    const result = await seed.list();
    expect(result.ok && result.value.stories).toHaveLength(5);
  });

  it('returns Not Found for an unknown ID and INVALID_ID for a bad one', async () => {
    expect(await seed.get('DEMO-999')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await seed.get('../etc')).toMatchObject({ ok: false, error: { code: 'INVALID_ID' } });
  });

  it('reports missing required fields by name', async () => {
    const source = await demoWith(JSON.stringify({ stories: [{ id: 'DEMO-102', title: 'x' }] }));
    expect(await source.get('DEMO-102')).toMatchObject({
      ok: false,
      error: { code: 'MISSING_FIELDS', fields: ['description', 'acceptanceCriteria'] },
    });
  });

  it('handles an empty backlog, malformed JSON and a missing file', async () => {
    expect(await (await demoWith('{"stories":[]}')).list()).toEqual({ ok: true, value: { stories: [], skipped: [] } });
    expect(await (await demoWith('{bad')).list()).toMatchObject({ ok: false, error: { code: 'MALFORMED' } });
    expect(await new LocalDemoStorySource(path.join(dir, 'none.json')).list()).toMatchObject({
      ok: false,
      error: { code: 'SOURCE_UNAVAILABLE' },
    });
  });
});

describe('source selection and Jira (mocked, no live Jira available)', () => {
  const jiraEnv = {
    STORY_SOURCE: 'jira',
    JIRA_BASE_URL: 'https://x.atlassian.net',
    JIRA_PROJECT_KEY: 'DEMO',
    JIRA_EMAIL: 'a@b.c',
    JIRA_API_TOKEN: 'super-secret-token',
  };
  const jira = (fetchImpl: typeof fetch) => {
    const config = loadConfig(jiraEnv);
    if (!config.ok || !config.value.jira) throw new Error('bad test config');
    return new JiraStorySource(config.value.jira, fetchImpl);
  };

  it('defaults to demo and uses Jira only when explicitly configured', () => {
    const demo = loadConfig({});
    expect(demo.ok && createStorySource(demo.value)).toMatchObject({ ok: true, value: { kind: 'demo' } });
    const configured = loadConfig(jiraEnv);
    expect(configured.ok && createStorySource(configured.value)).toMatchObject({ ok: true, value: { kind: 'jira' } });
    expect(loadConfig({ STORY_SOURCE: 'jira' })).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('maps a Jira issue to the same normalized story', async () => {
    const issue = {
      key: 'DEMO-7',
      fields: { summary: 'T', description: 'Body\nAcceptance Criteria:\n- one\n- two' },
    };
    const source = jira((async () => new Response(JSON.stringify(issue))) as typeof fetch);
    const result = await source.get('DEMO-7');
    expect(result.ok && result.value).toMatchObject({ id: 'DEMO-7', source: 'jira', acceptanceCriteria: ['one', 'two'] });
  });

  it('reports auth and Not Found failures without leaking the token or falling back to demo', async () => {
    const denied = await jira((async () => new Response('{}', { status: 401 })) as typeof fetch).get('DEMO-101');
    expect(denied).toMatchObject({ ok: false, error: { code: 'AUTH_FAILED' } });
    const missing = await jira((async () => new Response('{}', { status: 404 })) as typeof fetch).get('DEMO-999');
    expect(missing).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const broken = await jira((async () => {
      throw new Error('boom super-secret-token');
    }) as typeof fetch).get('DEMO-101');
    expect(JSON.stringify(broken)).not.toContain('super-secret-token');
    expect(broken).toMatchObject({ ok: false, error: { code: 'SOURCE_UNAVAILABLE' } });
  });
});

import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/configuration/config.js';
import { createLogger } from '../../src/configuration/logger.js';
import { redact } from '../../src/configuration/redact.js';

describe('loadConfig', () => {
  it('defaults to demo mode without any credentials', () => {
    const result = loadConfig({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.storySource).toBe('demo');
      expect(result.value.jira).toBeUndefined();
    }
  });

  it('treats .env.example placeholders as unset', () => {
    const result = loadConfig({ STORY_SOURCE: 'demo', JIRA_API_TOKEN: 'YOUR_JIRA_API_TOKEN_HERE' });
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid STORY_SOURCE', () => {
    const result = loadConfig({ STORY_SOURCE: 'confluence' });
    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('names missing Jira variables but never activates Jira implicitly', () => {
    const result = loadConfig({ STORY_SOURCE: 'jira', JIRA_BASE_URL: 'https://x.atlassian.net' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields).toEqual(['JIRA_PROJECT_KEY', 'JIRA_EMAIL', 'JIRA_API_TOKEN']);
    }
  });

  it('rejects non-https and malformed Jira URLs', () => {
    const base = { STORY_SOURCE: 'jira', JIRA_PROJECT_KEY: 'K', JIRA_EMAIL: 'a@b.c', JIRA_API_TOKEN: 'tok-12345' };
    expect(loadConfig({ ...base, JIRA_BASE_URL: 'http://x.atlassian.net' }).ok).toBe(false);
    expect(loadConfig({ ...base, JIRA_BASE_URL: 'not a url' }).ok).toBe(false);
  });

  it('builds Jira config when complete', () => {
    const result = loadConfig({
      STORY_SOURCE: 'jira',
      JIRA_BASE_URL: 'https://x.atlassian.net/',
      JIRA_PROJECT_KEY: 'K',
      JIRA_EMAIL: 'a@b.c',
      JIRA_API_TOKEN: 'tok-12345',
      JIRA_ACCEPTANCE_CRITERIA_FIELD: 'customfield_10000',
    });
    expect(result.ok && result.value.jira?.baseUrl).toBe('https://x.atlassian.net');
    expect(result.ok && result.value.jira?.acceptanceCriteriaField).toBe('customfield_10000');
  });
});

describe('redact', () => {
  it('masks secret env values and credential patterns', () => {
    const env = { JIRA_API_TOKEN: 'super-secret-value', APP_ENV: 'development' };
    const text = 'failed with super-secret-value and Basic dXNlcjpwYXNzd29yZA== and ghp_abcdefghijklmnopqrstuvwx';
    const out = redact(text, env);
    expect(out).not.toContain('super-secret-value');
    expect(out).not.toContain('dXNlcjpwYXNzd29yZA');
    expect(out).not.toContain('ghp_abcdefghijklmnopqrstuvwx');
  });

  it('does not mask non-secret values', () => {
    expect(redact('env development', { APP_ENV: 'development' })).toBe('env development');
  });

  it('logger never emits secrets', () => {
    const lines: string[] = [];
    const logger = createLogger({ JIRA_API_TOKEN: 'super-secret-value' }, (_l, line) => lines.push(line));
    logger.error('token=super-secret-value');
    expect(lines.join('')).not.toContain('super-secret-value');
  });
});

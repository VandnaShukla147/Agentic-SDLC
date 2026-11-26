import { err, ok, type Result } from '../integrations/errors.js';
import type { StorySourceKind } from '../integrations/types.js';
import { isPlaceholder } from './redact.js';

export interface JiraConfig {
  baseUrl: string;
  projectKey: string;
  email: string;
  apiToken: string;
  acceptanceCriteriaField?: string;
}

export interface AppConfig {
  appEnv: string;
  storySource: StorySourceKind;
  demoDataDir: string;
  jira?: JiraConfig;
}

function read(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  if (!value || isPlaceholder(value)) return undefined;
  return value;
}

/** Builds configuration from environment variables; demo mode needs none of the optional ones. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Result<AppConfig> {
  const source = read(env, 'STORY_SOURCE') ?? 'demo';
  if (source !== 'demo' && source !== 'jira') {
    return err('CONFIG', 'STORY_SOURCE must be "demo" or "jira".', ['STORY_SOURCE']);
  }

  const config: AppConfig = {
    appEnv: read(env, 'APP_ENV') ?? 'development',
    storySource: source,
    demoDataDir: read(env, 'DEMO_DATA_DIR') ?? 'demo/jira',
  };
  if (source === 'demo') return ok(config);

  const required = ['JIRA_BASE_URL', 'JIRA_PROJECT_KEY', 'JIRA_EMAIL', 'JIRA_API_TOKEN'] as const;
  const missing = required.filter((name) => read(env, name) === undefined);
  if (missing.length > 0) {
    return err('CONFIG', `Jira mode requires: ${missing.join(', ')}.`, [...missing]);
  }

  const baseUrl = read(env, 'JIRA_BASE_URL') as string;
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return err('CONFIG', 'JIRA_BASE_URL is not a valid URL.', ['JIRA_BASE_URL']);
  }
  if (parsed.protocol !== 'https:') {
    return err('CONFIG', 'JIRA_BASE_URL must use https.', ['JIRA_BASE_URL']);
  }

  const jira: JiraConfig = {
    baseUrl: parsed.origin,
    projectKey: read(env, 'JIRA_PROJECT_KEY') as string,
    email: read(env, 'JIRA_EMAIL') as string,
    apiToken: read(env, 'JIRA_API_TOKEN') as string,
  };
  const acField = read(env, 'JIRA_ACCEPTANCE_CRITERIA_FIELD');
  if (acField) jira.acceptanceCriteriaField = acField;
  config.jira = jira;
  return ok(config);
}

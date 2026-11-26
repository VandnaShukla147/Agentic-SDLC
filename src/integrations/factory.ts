import path from 'node:path';
import type { AppConfig } from '../configuration/config.js';
import { err, ok, type Result } from './errors.js';
import { JiraStorySource } from './jiraStorySource.js';
import { LocalDemoStorySource } from './localDemoStorySource.js';
import type { UserStorySource } from './types.js';

/** Selects the story source from configuration; Jira is used only when explicitly configured. */
export function createStorySource(
  config: AppConfig,
  baseDir: string = process.cwd(),
  fetchImpl?: typeof fetch,
): Result<UserStorySource> {
  if (config.storySource === 'jira') {
    if (!config.jira) return err('CONFIG', 'Jira mode selected but Jira configuration is missing.');
    return ok(new JiraStorySource(config.jira, fetchImpl));
  }
  return ok(new LocalDemoStorySource(path.resolve(baseDir, config.demoDataDir, 'stories.json')));
}

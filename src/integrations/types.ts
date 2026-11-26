import type { Result, StoryError } from './errors.js';

export type StorySourceKind = 'demo' | 'jira';

export interface Story {
  id: string;
  type: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority?: string;
  dependencies: string[];
  epicId?: string;
  status?: string;
  metadata: Record<string, unknown>;
  source: StorySourceKind;
}

export interface SkippedEntry {
  id?: string;
  error: StoryError;
}

export interface StoryListing {
  stories: Story[];
  skipped: SkippedEntry[];
}

export interface UserStorySource {
  readonly kind: StorySourceKind;
  list(): Promise<Result<StoryListing>>;
  get(id: string): Promise<Result<Story>>;
}

import { readFile } from 'node:fs/promises';
import { err, ok, type Result } from './errors.js';
import type { SkippedEntry, Story, StoryListing, UserStorySource } from './types.js';
import { isValidStoryId, normalizeStory } from './validation.js';

/** Reads stories from a local JSON backlog (default mode; no network or credentials). */
export class LocalDemoStorySource implements UserStorySource {
  readonly kind = 'demo' as const;

  constructor(private readonly storiesPath: string) {}

  async list(): Promise<Result<StoryListing>> {
    let text: string;
    try {
      text = await readFile(this.storiesPath, 'utf8');
    } catch {
      return err('SOURCE_UNAVAILABLE', 'Demo story file could not be read.');
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return err('MALFORMED', 'Demo story file is not valid JSON.');
    }
    const entries = (data as { stories?: unknown } | null)?.stories;
    if (!Array.isArray(entries)) {
      return err('MALFORMED', 'Demo story file must contain a "stories" array.');
    }

    const stories: Story[] = [];
    const skipped: SkippedEntry[] = [];
    for (const entry of entries) {
      const result = normalizeStory(entry, 'demo');
      if (result.ok) {
        stories.push(result.value);
        continue;
      }
      const rawId = (entry as { id?: unknown } | null)?.id;
      skipped.push(typeof rawId === 'string' ? { id: rawId, error: result.error } : { error: result.error });
    }
    return ok({ stories, skipped });
  }

  async get(id: string): Promise<Result<Story>> {
    if (!isValidStoryId(id)) {
      return err('INVALID_ID', 'Story ID has an invalid format.', ['id']);
    }
    const listing = await this.list();
    if (!listing.ok) return listing;

    const story = listing.value.stories.find((s) => s.id === id);
    if (story) return ok(story);

    const invalid = listing.value.skipped.find((s) => s.id === id);
    if (invalid) return { ok: false, error: invalid.error };
    return err('NOT_FOUND', `Story ${id} was not found.`);
  }
}

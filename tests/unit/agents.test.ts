import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGENTS } from '../../src/agents/registry.js';

const agentsDir = path.resolve('.github/agents');
const ALLOWED_KEYS = new Set(['name', 'description', 'tools', 'model']);
const ALLOWED_TOOLS = new Set(['read', 'search', 'edit', 'execute', 'agent', 'web', 'todo']);
const READ_ONLY_MCP = /^atlassian\/(getJiraIssue|searchJiraIssuesUsingJql|getAccessibleAtlassianResources)$/;

function frontmatter(text: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of (match[1] as string).split(/\r?\n/)) {
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (m) fields[m[1] as string] = (m[2] as string).trim();
  }
  return fields;
}

describe('agent registry vs .github/agents', () => {
  it('has exactly one agent file per registry entry', async () => {
    const files = (await readdir(agentsDir)).filter((f) => f.endsWith('.agent.md')).sort();
    expect(files).toEqual(AGENTS.map((a) => `${a.id}.agent.md`).sort());
  });

  it.each(AGENTS.map((a) => [a.id, a] as const))('%s matches its registry entry and uses only supported fields', async (id, agent) => {
    const text = await readFile(path.join(agentsDir, `${id}.agent.md`), 'utf8');
    const fm = frontmatter(text);
    expect(fm['name']).toBe(agent.name);
    expect((fm['description'] ?? '').length).toBeGreaterThan(20);
    for (const key of Object.keys(fm)) expect(ALLOWED_KEYS.has(key)).toBe(true);

    const tools = (fm['tools'] ?? '').replace(/[[\]'"\s]/g, '').split(',').filter(Boolean);
    expect(tools).toEqual(agent.tools);
    for (const tool of tools) expect(ALLOWED_TOOLS.has(tool) || READ_ONLY_MCP.test(tool), tool).toBe(true);
  });

  it.each(AGENTS.map((a) => [a.id] as const))('%s documents boundaries and failure behavior', async (id) => {
    const text = await readFile(path.join(agentsDir, `${id}.agent.md`), 'utf8');
    expect(text).toMatch(/failure behavior/i);
    expect(text).toMatch(/example/i);
  });

  it('no agent is instructed to approve gates; only the human approves', async () => {
    for (const agent of AGENTS) {
      const text = await readFile(path.join(agentsDir, `${agent.id}.agent.md`), 'utf8');
      expect(text).not.toMatch(/you (may|can|should) (run )?`?(workflow|docs) approve/i);
    }
  });

  it('only the orchestrator can delegate to other agents', () => {
    expect(AGENTS.filter((a) => a.tools.includes('agent')).map((a) => a.id)).toEqual(['orchestrator']);
  });

  it('only the Implementation Agent and QA agent can edit source/tests via execute+edit among non-documentation roles', () => {
    const withExecute = AGENTS.filter((a) => a.tools.includes('execute')).map((a) => a.id);
    expect(withExecute).toEqual(['orchestrator', 'implementer', 'qa-verifier', 'documentation', 'pr-publisher']);
  });

  it('the PR Publisher has no edit tool and the AI label is part of its procedure', async () => {
    const publisher = AGENTS.find((a) => a.id === 'pr-publisher');
    expect(publisher?.tools).not.toContain('edit');
    const text = await readFile(path.join(agentsDir, 'pr-publisher.agent.md'), 'utf8');
    expect(text).toMatch(/AI-Assisted-By:/);
    expect(text).toMatch(/gh pr create --base main/);
    expect(text).toMatch(/gh pr comment/);
  });
});

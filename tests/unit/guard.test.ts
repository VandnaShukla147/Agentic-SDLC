import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const guardPath = path.resolve('.github/hooks/guard.cjs');
const { evaluate } = require(guardPath) as {
  evaluate: (e: unknown, o?: { verdictFile?: string }) => { permissionDecision?: string };
};
const tmp = mkdtempSync(path.join(os.tmpdir(), 'guard-'));
const verdictFile = (name: string, text: string) => {
  const file = path.join(tmp, name);
  writeFileSync(file, text);
  return file;
};
const noVerdict = path.join(tmp, 'missing.md');
const approved = verdictFile('approved.md', '# Report\nFinal verdict: APPROVED\n');
const denied = (toolName: string, toolArgs: unknown, verdict = noVerdict) =>
  evaluate({ toolName, toolArgs }, { verdictFile: verdict }).permissionDecision === 'deny';
const fakeToken = ['gh', 'p_', 'a'.repeat(24)].join('');

describe('hook guard: human-in-the-loop boundaries', () => {
  it.each([
    'git commit -m "x"',
    'git push origin main',
    'git -C . merge feature',
    'git rebase main',
    'git reset --hard HEAD~1',
    'git commit -m "x" -m "AI-Assisted-By: a"',
    'git push -u origin feat/x',
    'gh pr create --base main --title x',
    'gh pr merge 5 --squash',
    'npm run cli -- workflow approve requirements',
    'echo hi > .sdlc/state.json',
  ])('denies shell command without a final APPROVED verdict: %s', (command) => {
    expect(denied('powershell', { command })).toBe(true);
  });

  it.each(['git status', 'git diff --stat', 'npm test', 'npm run cli -- workflow status'])(
    'allows shell command: %s',
    (command) => {
      expect(denied('powershell', { command })).toBe(false);
    },
  );

  it.each([
    ['edit', { path: '.sdlc/state.json' }],
    ['edit', { path: 'docs/approvals.json' }],
    ['create', { path: '.env' }],
    ['edit', { path: '.github/hooks/guard.cjs' }],
  ])('denies %s of protected file %j', (tool, args) => {
    expect(denied(tool, args)).toBe(true);
  });

  it('cannot be dodged with quoting, .exe, spacing or paths with spaces (code-review findings)', () => {
    for (const command of [
      'git.exe commit -m x',
      '& "C:\\Program Files\\Git\\cmd\\git.exe" commit -m x',
      'git -C "C:\\my dir" commit -m x',
      'gh -R a/b pr create',
      'npm run cli -- workflow "approve" requirements',
      'echo {}>docs/approvals.json',
      'echo x>.sdlc/state.json',
      'echo K=v>.env',
    ]) {
      expect(denied('powershell', { command }), command).toBe(true);
    }
  });

  it('allows .env.example and normal edits', () => {
    expect(denied('edit', { path: '.env.example' })).toBe(false);
    expect(denied('edit', { path: 'src/cli.ts', new_str: 'x' })).toBe(false);
  });
});

describe('hook guard: PR agent override after final review approval', () => {
  const allowed = (command: string) => !denied('powershell', { command }, approved);

  it.each([
    'git add src/a.ts docs/pr-description.md',
    'git commit -m "feat: x" -m "This commit was made by AI." -m "AI-Assisted-By: PR Publisher (Agentic SDLC)"',
    'git push -u origin feat/atlassian-mcp',
    'git push origin feat/x',
    'gh pr create --base main --title "[AI] x" --body-file docs/pr-description.md',
    'gh pr comment 5 --body "Raised by AI"',
  ])('allows with APPROVED verdict: %s', (command) => {
    expect(allowed(command)).toBe(true);
  });

  it.each([
    'git commit -m "x" -m "AI-Assisted-By: a" --no-verify',
    'git commit -m "no AI label"',
    'git commit',
    'git push --force origin feat/x',
    'git push -f origin feat/x',
    'git push --force-with-lease origin feat/x',
    'git push origin --delete feat/x',
    'git push origin +feat/x',
    'git push origin HEAD:main',
    'git push origin main',
    'git push origin master',
    'git push',
    'git push origin',
    'git push -u origin HEAD',
    'git.exe push origin main',
    'git status && git push origin main',
    'gh pr create --base develop --title x',
    'gh pr create --title x --body y',
    'git merge feature',
    'git rebase main',
    'git reset --hard HEAD~1',
    'gh pr merge 5 --squash',
    'gh pr review 5 --approve',
    'npm run cli -- workflow approve pr',
  ])('still denies even with APPROVED verdict: %s', (command) => {
    expect(allowed(command)).toBe(false);
  });

  it.each([
    ['rejected', 'Final verdict: REJECTED\n'],
    ['blocked', 'Final verdict: BLOCKED - tests failing\n'],
    ['absent', '# Report\nAll good.\n'],
    ['ambiguous', 'Final verdict: APPROVED\nFinal verdict: REJECTED\n'],
    ['duplicated', 'Final verdict: APPROVED\nFinal verdict: APPROVED\n'],
    ['inline', 'The Final verdict: APPROVED soon\n'],
  ])('does not override when the verdict is %s', (name, text) => {
    const file = verdictFile(`${name}.md`, text);
    const command = 'git push -u origin feat/x';
    expect(denied('powershell', { command }, file)).toBe(true);
  });
});

describe('hook guard: secrets and failure mode', () => {
  it('denies credentials in written content but allows placeholders', () => {
    expect(denied('create', { path: 'src/a.ts', file_text: `const t = "${fakeToken}";` })).toBe(true);
    expect(denied('edit', { path: '.env.example', new_str: 'JIRA_API_TOKEN=YOUR_JIRA_API_TOKEN_HERE' })).toBe(false);
  });

  it('denies Atlassian MCP write tools but allows read tools', () => {
    for (const tool of ['atlassian-createJiraIssue', 'atlassian/editJiraIssue', 'transitionJiraIssue', 'atlassian-executeWrite', 'updateConfluenceContent']) {
      expect(denied(tool, { projectKey: 'SCRUM' }), tool).toBe(true);
    }
    for (const tool of ['atlassian-getJiraIssue', 'atlassian/searchJiraIssuesUsingJql', 'atlassian-getAccessibleAtlassianResources']) {
      expect(denied(tool, { issueIdOrKey: 'SCRUM-6' }), tool).toBe(false);
    }
  });

  it('fails closed on unreadable events and works as a process', () => {
    expect(evaluate(null).permissionDecision).toBe('deny');
    const run = (input: string) => spawnSync(process.execPath, [guardPath], { input, encoding: 'utf8' });
    expect(JSON.parse(run('not json').stdout).permissionDecision).toBe('deny');
    expect(JSON.parse(run(JSON.stringify({ toolName: 'view', toolArgs: { path: 'README.md' } })).stdout)).toEqual({});
  });
});

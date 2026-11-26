import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const guardPath = path.resolve('.github/hooks/guard.cjs');
const { evaluate } = require(guardPath) as { evaluate: (e: unknown) => { permissionDecision?: string } };
const denied = (toolName: string, toolArgs: unknown) => evaluate({ toolName, toolArgs }).permissionDecision === 'deny';
const fakeToken = ['gh', 'p_', 'a'.repeat(24)].join('');

describe('hook guard: human-in-the-loop boundaries', () => {
  it.each([
    'git commit -m "x"',
    'git push origin main',
    'git -C . merge feature',
    'gh pr create --title x',
    'npm run cli -- workflow approve requirements',
    'echo hi > .sdlc/state.json',
  ])('denies shell command: %s', (command) => {
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

describe('hook guard: secrets and failure mode', () => {
  it('denies credentials in written content but allows placeholders', () => {
    expect(denied('create', { path: 'src/a.ts', file_text: `const t = "${fakeToken}";` })).toBe(true);
    expect(denied('edit', { path: '.env.example', new_str: 'JIRA_API_TOKEN=YOUR_JIRA_API_TOKEN_HERE' })).toBe(false);
  });

  it('fails closed on unreadable events and works as a process', () => {
    expect(evaluate(null).permissionDecision).toBe('deny');
    const run = (input: string) => spawnSync(process.execPath, [guardPath], { input, encoding: 'utf8' });
    expect(JSON.parse(run('not json').stdout).permissionDecision).toBe('deny');
    expect(JSON.parse(run(JSON.stringify({ toolName: 'view', toolArgs: { path: 'README.md' } })).stdout)).toEqual({});
  });
});

# PR: Agentic SDLC pipeline for Automated Documentation Sync (DEMO-101)

## Summary
Adds a GitHub Copilot–driven SDLC pipeline (9 custom agents, 8 prompts, 6 skills, repository instructions and a `preToolUse` guardrail hook) plus a small TypeScript CLI that ingests user stories from a local demo backlog (optional Jira) and enforces human approval gates. It demonstrates a story moving from requirements to a PR with the human in control, and works without Jira.

## Changes Made
- `.github/copilot-instructions.md` — shared project rules and approval rules.
- `.github/agents/*.agent.md` (9) — one role each with least-privilege tools and failure behavior.
- `.github/prompts/*.prompt.md` (8), `.github/skills/*/SKILL.md` (6) — stage prompts and repeatable procedures.
- `.github/hooks/guardrails.json`, `guard.cjs` — deterministic guardrail: blocks commit/push/PR/approvals, `.sdlc`, ledger, `.env`, secrets.
- `src/` — config and redaction, story sources (demo, Jira), workflow with approval ledger, `docs check`, CLI, agent registry.
- `tests/unit/*` — 90 tests (stories, validation, config, workflow gates, guard, agents).
- `demo/jira/*.json` — seed backlog DEMO-EPIC-001, DEMO-101..105.
- `docs/` — requirements, architecture, design review, impl plan, code review, verification report, traceability matrix, agent architecture, project config.
- `README.md`, `CHANGELOG.md`, `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`.

## Test Evidence
From `docs/verification-report.md` (real runs): `npm run typecheck` PASS · `npm run lint` PASS · `npm test` → `Test Files 6 passed (6)`, `Tests 90 passed (90)` · `npm run build` PASS · `npm audit` → `found 0 vulnerabilities` · `npm run cli -- docs check` → `Requirements: 14 | traced: 14 | missing: 0`.

## Known Limitations
- Live Jira verified for a single get-by-key on one Jira Cloud site (SCRUM-6); auth/network failure paths are mocked only; Jira listing not implemented.
- Hook not yet confirmed inside a live Copilot session (BLOCKED, manual step); hooks are guardrails, not a security boundary.
- No CI workflow in this PR.
- Early gates were approved in chat, so `docs/approvals.json` has no entries.
- Seed backlog stories DEMO-102..105 are demo data, not implemented features.

## Reviewer Checklist
- [ ] `npm install && npm test` passes locally
- [ ] `npm run cli -- stories show DEMO-101` works with no credentials
- [ ] Try `git commit` through a Copilot agent and confirm the hook denies it
- [ ] Requirements trace to tests in `docs/traceability-matrix.md`
- [ ] No secrets in the diff; `.env` is ignored, `.env.example` has placeholders only
- [ ] Known limitations above are acceptable
- [ ] Human decides whether to merge (never merged automatically)

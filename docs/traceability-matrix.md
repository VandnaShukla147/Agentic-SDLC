# Traceability Matrix

User Story → Requirement → Architecture component → Implementation task → Code/File → Test → PR.
Story: DEMO-101 "Import and Analyze User Stories" (epic DEMO-EPIC-001). PR: not yet created (human decides; see `docs/pr-description.md`).

| Req | Story AC | Component | Task | Code | Test |
|---|---|---|---|---|---|
| REQ-F-001 | AC1 retrieve by ID | `UserStorySource.get` | T04 | `src/integrations/localDemoStorySource.ts` | `tests/unit/stories.test.ts` (retrieves a story by ID) |
| REQ-F-002 | AC2 normalized story | normalizer | T03 | `src/integrations/validation.ts` | `tests/unit/validation.test.ts` |
| REQ-F-003 | AC3 missing fields | normalizer | T03 | `src/integrations/validation.ts` | `validation.test.ts`, `stories.test.ts` (missing required fields) |
| REQ-F-004 | AC4 Not Found | `StoryError.NOT_FOUND` | T04 | `localDemoStorySource.ts`, `errors.ts` | `stories.test.ts` (Not Found) |
| REQ-F-005 | AC5 no Jira credentials | `LocalDemoStorySource` | T04 | `localDemoStorySource.ts`, `demo/jira/stories.json` | `stories.test.ts` (seed backlog) |
| REQ-F-006 | AC6 record source | `Story.source` | T03 | `src/integrations/types.ts` | `validation.test.ts`, `stories.test.ts` |
| REQ-F-007 | list, empty, malformed | `UserStorySource.list` | T04 | `localDemoStorySource.ts` | `stories.test.ts` (empty/malformed/missing file) |
| REQ-F-008 | `STORY_SOURCE` selection, no fallback | `loadConfig`, `createStorySource` | T02, T04 | `src/configuration/config.ts`, `src/integrations/factory.ts` | `config.test.ts`, `stories.test.ts` |
| REQ-F-009 | common abstraction | `UserStorySource`, `JiraStorySource` | T05 | `src/integrations/types.ts`, `jiraStorySource.ts` | `stories.test.ts` (Jira mocked) |
| REQ-N-001 | no secrets in output | `redact`, logger, hook guard | T02, T13 | `src/configuration/redact.ts`, `.github/hooks/guard.cjs` | `config.test.ts`, `guard.test.ts` |
| REQ-N-002 | input validation | ID regex, `safeResolve` | T03, T06 | `validation.ts`, `src/documentation/fsSafe.ts` | `validation.test.ts` |
| REQ-N-003 | structured errors | `StoryError`, CLI exit codes | T03, T11 | `src/integrations/errors.ts`, `src/cli.ts` | `stories.test.ts` |
| REQ-N-004 | Jira isolated | factory + interface | T05 | `jiraStorySource.ts`, `factory.ts` | `stories.test.ts` |
| REQ-N-005 | automated tests | Vitest | all | `tests/unit/*` | `npm test` (see `docs/verification-report.md`) |

## Agentic workflow controls (capstone focus)

| Control | Mechanism | Where | Test |
|---|---|---|---|
| Human approves every gate | TTY-only typed confirmation; ledger with artifact SHA-256 | `src/orchestration/workflow.ts`, `ttyConfirm.ts`, `docs/approvals.json` | `workflow.test.ts` |
| Stages cannot be skipped | stage state machine | `src/orchestration/stages.ts` | `workflow.test.ts` |
| Agents cannot commit/push/approve/edit state or secrets | `preToolUse` hook | `.github/hooks/guard.cjs`, `guardrails.json` | `guard.test.ts` |
| Agent set matches registry | registry consistency | `src/agents/registry.ts`, `.github/agents/*` | `agents.test.ts` |
| Docs trace every requirement | `docs check` | `src/documentation/docCheck.ts` | `workflow.test.ts` (docs check) |

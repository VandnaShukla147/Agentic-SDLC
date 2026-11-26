# Automated Documentation Sync — Agentic SDLC capstone

A GitHub Copilot–driven SDLC pipeline: custom agents, prompts, skills, instructions and a guardrail hook take a user story from requirements to a PR, with human approval gates. A small TypeScript CLI supplies the story source, workflow state and the approval ledger. Works offline with the local demo backlog; Jira is optional.

## Setup
```
npm install
npm test            # typecheck: npm run typecheck | lint: npm run lint
```
Windows: if PowerShell blocks `npm`, run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` or use `npm.cmd`.

Optional: copy `.env.example` to `.env` (git-ignored). Demo mode (`STORY_SOURCE=demo`, default) needs no credentials. See `docs/project-config.md`.

## Demo (no Jira needed)
```
npm run cli -- stories list
npm run cli -- stories show DEMO-101
npm run cli -- workflow start DEMO-101     # writes .sdlc/inputs/DEMO-101.md for the Requirements Analyst
npm run cli -- workflow status
npm run cli -- workflow approve requirements   # human only, interactive terminal
npm run cli -- workflow complete requirements --evidence docs/requirements.md
npm run cli -- docs check
npm run cli -- audit show
```
In Copilot Chat run the stage prompts in order: `/requirements`, `/architecture`, `/design-review`, `/impl-plan`, `/implement-task`, `/code-review`, `/verify`, `/pr`. Each stops for your approval.

## Where things are
| Path | Purpose |
|---|---|
| `.github/copilot-instructions.md`, `agents/`, `prompts/`, `skills/`, `hooks/` | the agentic layer (see `docs/agent-architecture.md`) |
| `demo/jira/` | seed backlog: DEMO-EPIC-001, DEMO-101..105 (proposed demo data, not approved requirements) |
| `src/`, `tests/` | CLI, story sources, workflow gates, `docs check` |
| `docs/` | requirements, architecture, design review, impl plan, traceability matrix, code review, verification report, PR description |

## Atlassian MCP (optional, read-only)

`.mcp.json` registers the Atlassian MCP server (`https://mcp.atlassian.com/v2/mcp`, HTTP + OAuth; no secrets in the file) with only three read tools allowed. The Requirements Analyst may use `getJiraIssue` and `searchJiraIssuesUsingJql` for extra context; the story handoff from the CLI stays the source of truth. The hook denies every Jira/Confluence write tool, so agents cannot change Jira.
To use it: open the repo in VS Code, run **MCP: List Servers** (or `/mcp` in Copilot CLI), start `atlassian` and complete the browser sign-in. The app itself does not need the MCP (it uses the REST token).

## Rules
Agents never approve gates, merge or force-push; the hook enforces this. Override: when the QA and Verification Agent records `Final verdict: APPROVED` in `docs/verification-report.md`, the PR Publisher agent may stage, commit (message and `AI-Assisted-By` trailer say it was made by AI), push the feature branch and raise a PR to `main` titled `[AI] ...` with a comment saying it was raised by AI. It needs `gh auth login` once. Secrets only via environment variables. A human reviews and merges every PR.

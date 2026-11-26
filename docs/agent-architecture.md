# Agent Architecture

How the Copilot agents, prompts, skills and hook collaborate while a human stays in control.

## Pipeline

```mermaid
flowchart TD
  H([Human picks story]) --> O[Orchestrator]
  O --> RA[Requirements Analyst] --> G1{{Human approves: requirements}}
  G1 --> AR[Architect] --> DR[Design Reviewer] --> G2{{Human approves: architecture}}
  G2 --> PL[Implementation Planner] --> G3{{Human approves: plan}}
  G3 --> IM[Implementation Agent] --> CR[Code Reviewer] --> QA[QA and Verification]
  QA --> DA[Documentation Agent] --> G4{{Human approves: doc-changes}}
  G4 --> PR[Draft PR via prepare-pr skill] --> G5{{Human approves: pr}}
  QA -. Final verdict APPROVED .-> PP[PR Publisher: stage, commit as AI, push branch, raise PR to main as AI] --> M{{Human reviews and merges}}
  HK[[preToolUse hook guard]] -. blocks commit, push, PR, merge, approvals, .sdlc, .env, secrets unless the override applies .-> O
```

## Agents (`.github/agents/*.agent.md`, registry in `src/agents/registry.ts`)

| Agent | Output | Tools | Gate after |
|---|---|---|---|
| Orchestrator | stage hand-offs | read, search, execute, agent | never approves |
| Requirements Analyst | `docs/requirements.md` | read, search, edit | requirements |
| Architect | `docs/architecture.md` | read, search, edit | - |
| Design Reviewer | `docs/design-review.md` | read, search, edit | architecture |
| Implementation Planner | `docs/impl-plan.md` | read, search, edit | plan |
| Implementation Agent | `src/**`, `tests/**` | read, search, edit, execute | - |
| Code Reviewer | `docs/code-review.md` | read, search, edit | - |
| QA and Verification | `docs/verification-report.md` | read, search, edit, execute | - |
| Documentation Agent | README, CHANGELOG, traceability (after approval) | read, search, edit, execute | doc-changes |
| PR Publisher | git commit (`AI-Assisted-By` trailer), pushed feature branch, PR to `main` + AI-authorship comment | read, search, execute | after QA `Final verdict: APPROVED`; human merges |

Agent frontmatter uses only `name`, `description`, `tools`; no model is pinned, so no model claims are made.

## Customization building blocks

| Block | Files | Role |
|---|---|---|
| Instructions | `.github/copilot-instructions.md` | project rules shared by all agents |
| Agents | `.github/agents/` | one role each, least-privilege tools, explicit failure behavior |
| Prompts | `.github/prompts/` | one per stage; start a stage and invoke its agent |
| Skills | `.github/skills/*/SKILL.md` | repeatable procedures (analyze story, requirements, review, doc sync, verification, PR) |
| Hook | `.github/hooks/guardrails.json` + `guard.cjs` | deterministic `preToolUse` checks; fail-closed on bad input |

## Human-in-the-loop

- `workflow approve|reject <gate>` only works in an interactive terminal and requires typing the gate name. The hook also denies agents from running it.
- Each approval is written to `docs/approvals.json` with the SHA-256 of the approved files. If a file changes later, the gate and later gates are invalidated automatically (`workflow status`, `workflow verify`).
- Override: the hook keeps denying `git commit/push/merge/rebase`, `reset --hard` and `gh pr create/merge`. Only while `docs/verification-report.md` has exactly one line `Final verdict: APPROVED` does it allow `git commit` carrying an `AI-Assisted-By:` trailer (no `--no-verify`), `git push [-u] origin <branch>` (not main/master/HEAD, no force flags) and `gh pr create --base main`. Merge, rebase, `reset --hard` and `gh pr merge|review` are never allowed. The hook cannot tell which agent is calling and the verdict is a file an agent with edit rights could write, so "only the PR Publisher, only after the QA agent approved" also rests on agent instructions and human review of the PR.
- Hooks are guardrails, not a security boundary; the final control is human review of the PR.

## What is deterministic vs LLM vs human

| Kind | Examples |
|---|---|
| Deterministic code | story validation, config, redaction, workflow/gate logic, hook guard, `docs check` |
| Agent instructions (LLM) | requirements, architecture, review, planning, implementation, doc proposals |
| Human decisions | every gate, doc change approval, PR review and merge |

## Atlassian MCP (optional)

Config: `.mcp.json` (server `atlassian`, three read-only tools). Only the Requirements Analyst has `atlassian/getJiraIssue` and `atlassian/searchJiraIssuesUsingJql`. The `preToolUse` hook denies all Jira/Confluence write tools, so Jira changes remain human actions. The app does not depend on the MCP; losing it leaves the REST-based story source and the pipeline unchanged.

## Failure handling

Agents report failures with real output and stop; the workflow refuses out-of-order or unapproved transitions; the app returns typed errors (`NOT_FOUND`, `MISSING_FIELDS`, `AUTH_FAILED`, ...) and never falls back from Jira to demo data silently.

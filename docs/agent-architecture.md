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
  G4 --> PR[Draft PR via prepare-pr skill] --> G5{{Human decides: create PR}}
  HK[[preToolUse hook guard]] -. blocks commit, push, approvals, .sdlc, .env, secrets .-> O
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
- Hooks are guardrails, not a security boundary; the final control is human review of the PR.

## What is deterministic vs LLM vs human

| Kind | Examples |
|---|---|
| Deterministic code | story validation, config, redaction, workflow/gate logic, hook guard, `docs check` |
| Agent instructions (LLM) | requirements, architecture, review, planning, implementation, doc proposals |
| Human decisions | every gate, doc change approval, commit/push/PR creation |

## Failure handling

Agents report failures with real output and stop; the workflow refuses out-of-order or unapproved transitions; the app returns typed errors (`NOT_FOUND`, `MISSING_FIELDS`, `AUTH_FAILED`, ...) and never falls back from Jira to demo data silently.

# Project Configuration and Onboarding

Single place for project information, stack, and credentials. Values in `[BRACKETS]` have **not been supplied** and must not be invented. Fill them in or tell the Requirements Analyst agent.

## 1. Project information

| Field | Value |
|---|---|
| Project name | Automated Documentation Sync (repository: `Agentic-SDLC`) |
| Description | `[PROJECT_DESCRIPTION]` |
| Business objective | `[BUSINESS_OBJECTIVE]` |
| Target users | `[TARGET_USERS]` |
| Functional requirements | `[FUNCTIONAL_REQUIREMENTS]` (see `docs/requirements.md` once approved) |
| Non-functional requirements | `[NON_FUNCTIONAL_REQUIREMENTS]` |
| Out of scope | `[OUT_OF_SCOPE]` |
| Constraints | `[PROJECT_CONSTRAINTS]` |

## 2. Technology stack (confirmed by the human)

| Field | Value |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 22 (detected: v22.18.0) |
| Framework | None (CLI) |
| Package manager | npm |
| Database | None |
| Testing | Vitest |
| Deployment | `[DEPLOYMENT_PLATFORM]` (local CLI; not yet decided) |
| Logging | `[LOGGING_SOLUTION]` (proposed in architecture, pending approval) |

## 3. GitHub

| Field | Value |
|---|---|
| Repository URL | https://github.com/VandnaShukla147/Agentic-SDLC |
| Owner | VandnaShukla147 |
| Default branch | main |
| Organization | `[GITHUB_ORGANIZATION_OR_NONE]` |

## 4. Environment variables

Never paste secrets into Copilot Chat. Configure them in a local `.env` file (copied from `.env.example`, git-ignored) or your shell/CI secret store.

| Variable | Purpose | Required? | Where to obtain | Where to configure | Feature | Needed for |
|---|---|---|---|---|---|---|
| `APP_ENV` | Runtime environment name | Optional (default `development`) | n/a | `.env` | All | dev, test, prod |
| `STORY_SOURCE` | Selects story source: `demo` or `jira` | Optional (default `demo`) | n/a | `.env` | Story ingestion | dev, test, prod |
| `GITHUB_TOKEN` | Authenticated GitHub access for PR preparation | Optional | GitHub > Settings > Developer settings > Tokens | `.env` / CI secret | PR creation (only after human approval) | production workflow |
| `GITHUB_REPOSITORY_URL` | Target repo for PR text | Optional | Repository page | `.env` | PR preparation | dev, prod |
| `JIRA_BASE_URL` | Jira site URL | Mandatory only if `STORY_SOURCE=jira` | Your Atlassian site | `.env` | Jira story source | prod (future) |
| `JIRA_PROJECT_KEY` | Jira project key | Mandatory only if `STORY_SOURCE=jira` | Jira project settings | `.env` | Jira story source | prod (future) |
| `JIRA_EMAIL` | Jira account email | Mandatory only if `STORY_SOURCE=jira` | Your Atlassian account | `.env` | Jira story source | prod (future) |
| `JIRA_API_TOKEN` | Jira API token | Mandatory only if `STORY_SOURCE=jira` | id.atlassian.com > Security > API tokens | `.env` / CI secret | Jira story source | prod (future) |
| `JIRA_ACCEPTANCE_CRITERIA_FIELD` | Custom field id that holds acceptance criteria | Optional (falls back to the description's "Acceptance Criteria" section) | Jira admin / field settings | `.env` | Jira story source | prod (future) |
| `CONFLUENCE_BASE_URL` / `_EMAIL` / `_API_TOKEN` / `_SPACE_KEY` | Confluence access | Optional; only if approved requirements need Confluence | Atlassian account / space settings | `.env` | Confluence story source (not planned for demo) | prod (future) |

Not included (not needed by the approved stack): `LLM_*` (no LLM API in the app; Copilot agents do the reasoning) and `DATABASE_URL` (no database).

## 5. Rules

- Demo mode is the default and needs no credentials or network.
- Jira mode is never activated automatically and never silently falls back to demo mode; failures are reported clearly.
- Credential values are never logged or echoed.

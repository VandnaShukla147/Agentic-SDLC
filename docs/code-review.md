# Code Review

Independent review by a separate Copilot `code-review` agent (read-only) on `src/**`, `.github/hooks/guard.cjs` and `tests/**`, against `docs/requirements.md`. Checklist areas: correctness, security, error handling, test coverage, clarity, DRY, dependency safety.

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| CR-1 | High | Hook missed shell writes with no space before `>` (`echo x>docs/approvals.json`) | Fixed: protected paths are matched across the whole command; regression test in `guard.test.ts` |
| CR-2 | High | `git.exe commit`, `git -C "dir with spaces" commit`, `gh -R x pr create` bypassed the block | Fixed: quotes stripped, `.exe` and options tolerated; regression test |
| CR-3 | Medium | `workflow "approve"` (quoted verb) bypassed the approval block | Fixed (quote stripping); regression test |
| CR-4 | Medium | `JIRA_ACCEPTANCE_CRITERIA_FIELD` was read but unused | Fixed in `jiraStorySource.ts` |
| CR-5 | Medium | ADF inline runs were split into separate lines | Fixed: inline text joined, newlines only between blocks |
| CR-6 | Medium | A committed ledger could satisfy a new run / another story | Fixed: approvals carry `storyId`, must match the current story and exactly the gate's artifacts; regression test in `workflow.test.ts` |

Remaining (documented, not fixed): the hook cannot stop interpreter-based bypasses (`node -e`, `python -c`) — it is a guardrail, not a security boundary (see `docs/agent-architecture.md`); `git pull` is not blocked; Jira listing is not implemented (get-by-key only). No Critical/High findings remain open.

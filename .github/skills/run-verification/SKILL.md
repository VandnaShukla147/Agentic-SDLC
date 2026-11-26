---
name: run-verification
description: Run the full verification suite and record real evidence. Use in Stage 7.
---
Run, in order: `npm run typecheck`, `npm run lint`, `npm test`, `npm audit`, `npm run cli -- docs check`. For each, record command, result and an output excerpt in `docs/verification-report.md`. Mark checks that cannot run (live Jira, CI, hook inside Copilot) as BLOCKED with the reason. Never fabricate output.

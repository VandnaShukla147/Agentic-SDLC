---
description: Stage 6 - structured code review using the capstone checklist
agent: Code Reviewer
---
Review the implementation against `docs/requirements.md` for: correctness, security (secrets, input validation), error handling (API failures, missing files, empty data), test coverage (happy path, Not Found, missing fields), code clarity, DRY, dependency safety (run `npm audit`). Write findings with severity to `docs/code-review.md`.

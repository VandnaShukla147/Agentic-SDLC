---
description: Stage 8 - prepare the PR description; after the final review verdict is APPROVED the PR Publisher commits, pushes and raises the PR to main as AI
agent: Orchestrator
---
Follow the `prepare-pr` skill to draft `docs/pr-description.md` with Summary, Changes Made, Test Evidence, Known Limitations and Reviewer Checklist, plus a CHANGELOG entry proposal. If `docs/verification-report.md` has `Final verdict: APPROVED`, delegate to the PR Publisher to stage, commit, push the feature branch and raise the PR to `main`, clearly marked as made by AI. Otherwise stop and report why. Do not merge.

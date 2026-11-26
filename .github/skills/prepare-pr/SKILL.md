---
name: prepare-pr
description: Draft the pull request description, changelog entry and reviewer checklist, then hand off to the PR Publisher once the final verdict is APPROVED. Use in Stage 8.
---
Write `docs/pr-description.md` with exactly these sections: Summary (2-3 sentences), Changes Made (every added/modified file with reason), Test Evidence (real output from `docs/verification-report.md`), Known Limitations (Not Found, BLOCKED, out of scope), Reviewer Checklist (tick-list). Add a CHANGELOG entry. Then, only if `docs/verification-report.md` contains `Final verdict: APPROVED`, hand off to the PR Publisher agent, which stages, commits (explicit AI message plus `AI-Assisted-By` trailer), pushes the feature branch and raises the PR to `main` marked as AI. Otherwise stop and report. Never merge.

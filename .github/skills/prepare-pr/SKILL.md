---
name: prepare-pr
description: Draft the pull request description, changelog entry and reviewer checklist. Use in Stage 8; never creates the PR itself.
---
Write `docs/pr-description.md` with exactly these sections: Summary (2-3 sentences), Changes Made (every added/modified file with reason), Test Evidence (real output from `docs/verification-report.md`), Known Limitations (Not Found, BLOCKED, out of scope), Reviewer Checklist (tick-list). Add a CHANGELOG entry. Then stop: the human decides whether to commit, push and open the PR. Never merge.

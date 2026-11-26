---
name: sync-documentation
description: Find documentation affected by approved requirements, propose changes for human approval, apply only approved edits, and verify traceability.
---
1. List affected docs with a reason each; list docs deliberately left untouched.
2. Show the human each proposed change (file, text, story ID, requirement IDs) and wait for approval.
3. Apply only approved edits, preserving existing content; flag contradictions instead of overwriting.
4. Run `npm run cli -- docs check`; every REQ ID must appear in `docs/traceability-matrix.md`.

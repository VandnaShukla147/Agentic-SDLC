# Changelog

## [Unreleased]
### Added
- PR Publisher agent and a guard override: once the QA agent records `Final verdict: APPROVED`, it stages, commits (explicit AI message and `AI-Assisted-By` trailer), pushes the feature branch and raises a PR to `main` marked as AI. Without the verdict, and for merge/rebase/hard reset/force push/pushes to main, the original deny rules apply.
- Agentic SDLC pipeline for Automated Documentation Sync: 9 custom agents, 8 prompts, 6 skills, repository instructions and a `preToolUse` guardrail hook (`.github/`).
- CLI (`npm run cli`) with story ingestion from a local demo backlog (default, no credentials) and an optional Jira source (DEMO-101).
- Human approval gates with a committed approval ledger bound to artifact hashes, and `docs check` requirement traceability.
- Documents: requirements, architecture, design review, implementation plan, traceability matrix, agent architecture, verification report.

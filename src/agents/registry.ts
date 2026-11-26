export interface AgentSpec {
  /** File name stem under .github/agents/ (<id>.agent.md). */
  id: string;
  name: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  tools: string[];
  /** Human gate that follows this agent's work, if any. */
  gate?: string;
}

/** Single source of truth for the agent set; a test keeps it consistent with .github/agents. */
export const AGENTS: readonly AgentSpec[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    purpose: 'Coordinates the SDLC stages, enforces order and gates, delegates to specialist agents. Never approves.',
    inputs: ['workflow status', 'story ID chosen by the human'],
    outputs: ['stage hand-offs', 'workflow state via the CLI'],
    tools: ['read', 'search', 'execute', 'agent'],
  },
  {
    id: 'requirements-analyst',
    name: 'Requirements Analyst',
    purpose: 'Turns the selected story into structured requirements and clarification questions.',
    inputs: ['.sdlc/inputs/<ID>.md'],
    outputs: ['docs/requirements.md'],
    tools: ['read', 'search', 'edit', 'atlassian/getJiraIssue', 'atlassian/searchJiraIssuesUsingJql'],
    gate: 'requirements',
  },
  {
    id: 'architect',
    name: 'Architect',
    purpose: 'Proposes architecture from approved requirements.',
    inputs: ['docs/requirements.md'],
    outputs: ['docs/architecture.md'],
    tools: ['read', 'search', 'edit'],
  },
  {
    id: 'design-reviewer',
    name: 'Design Reviewer',
    purpose: 'Independently reviews the architecture and records findings.',
    inputs: ['docs/requirements.md', 'docs/architecture.md'],
    outputs: ['docs/design-review.md'],
    tools: ['read', 'search', 'edit'],
    gate: 'architecture',
  },
  {
    id: 'implementation-planner',
    name: 'Implementation Planner',
    purpose: 'Breaks the approved architecture into dependency-ordered tasks.',
    inputs: ['docs/requirements.md', 'docs/architecture.md'],
    outputs: ['docs/impl-plan.md'],
    tools: ['read', 'search', 'edit'],
    gate: 'plan',
  },
  {
    id: 'implementer',
    name: 'Implementation Agent',
    purpose: 'Implements one approved task at a time with tests and evidence.',
    inputs: ['docs/impl-plan.md task', 'docs/architecture.md'],
    outputs: ['src/**', 'tests/**', 'task evidence'],
    tools: ['read', 'search', 'edit', 'execute'],
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    purpose: 'Independent structured review of the implementation.',
    inputs: ['git diff', 'docs/requirements.md', 'docs/architecture.md'],
    outputs: ['docs/code-review.md'],
    tools: ['read', 'search', 'edit'],
  },
  {
    id: 'qa-verifier',
    name: 'QA and Verification Agent',
    purpose: 'Runs the verification suite and reports real evidence.',
    inputs: ['docs/requirements.md', 'src/**', 'tests/**'],
    outputs: ['docs/verification-report.md'],
    tools: ['read', 'search', 'edit', 'execute'],
  },
  {
    id: 'documentation',
    name: 'Documentation Agent',
    purpose: 'Proposes documentation changes for human approval, then applies only the approved edits.',
    inputs: ['docs/requirements.md', 'implemented code', 'docs/traceability-matrix.md'],
    outputs: ['README.md', 'CHANGELOG.md', 'docs/traceability-matrix.md'],
    tools: ['read', 'search', 'edit', 'execute'],
    gate: 'doc-changes',
  },
  {
    id: 'pr-publisher',
    name: 'PR Publisher',
    purpose: 'After the pr gate is approved, stages, commits (AI-labelled), pushes the feature branch and opens a PR to main with an AI-authorship comment. Never merges.',
    inputs: ['approved pr gate', 'docs/pr-description.md', 'docs/verification-report.md'],
    outputs: ['git commit', 'pushed feature branch', 'pull request to main'],
    tools: ['read', 'search', 'execute'],
  },
];

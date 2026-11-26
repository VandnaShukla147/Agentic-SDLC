'use strict';
const fs = require('node:fs');
const path = require('node:path');
// preToolUse guardrail for Copilot. Deterministic checks only; fail-closed on unreadable input.
// Hooks are guardrails, not a security boundary (see docs/architecture.md section 7).

const SECRET_PATTERNS = [
  /github_pat_[A-Za-z0-9_]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Z_]*(?:API_TOKEN|API_KEY|SECRET|PASSWORD)\s*[=:]\s*['"]?(?!YOUR_)[A-Za-z0-9/+_-]{20,}/,
];

const PATH_KEYS = ['path', 'filePath', 'file_path', 'file', 'filename', 'filepath', 'uri', 'target'];
const PATH_LIST_KEYS = ['paths', 'files', 'filePaths'];
const CONTENT_KEYS = ['content', 'file_text', 'new_str', 'newString', 'new_string', 'text', 'patch', 'input', 'replacement'];

const SHELL_TOOL = /(^|[^a-z])(bash|powershell|shell|terminal|execute|run_?command|runinterminal)([^a-z]|$)/i;
const WRITE_TOOL = /(edit|create|write|patch|replace|insert|delete|move|rename)/i;

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^[A-Za-z]:/, '').replace(/\/+/g, '/');
}

function protectedReason(rawPath) {
  const p = normalizePath(rawPath);
  const lower = p.toLowerCase();
  if (/(^|\/)\.sdlc(\/|$)/.test(lower)) return 'workflow state (.sdlc) is managed by the CLI only';
  if (/(^|\/)docs\/approvals\.json$/.test(lower)) return 'the approval ledger is written only by a human-confirmed CLI approval';
  if (/(^|\/)\.github\/hooks(\/|$)/.test(lower)) return 'hook guardrails are changed by humans only';
  const base = lower.split('/').pop() || '';
  if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') return 'environment files may contain secrets';
  return null;
}

function parseArgs(args) {
  if (typeof args === 'string') {
    try {
      return JSON.parse(args);
    } catch {
      return { input: args };
    }
  }
  return args && typeof args === 'object' ? args : {};
}

function collectPaths(args) {
  const out = [];
  for (const key of PATH_KEYS) if (typeof args[key] === 'string') out.push(args[key]);
  for (const key of PATH_LIST_KEYS) {
    if (Array.isArray(args[key])) for (const v of args[key]) if (typeof v === 'string') out.push(v);
  }
  const patch = typeof args.input === 'string' ? args.input : typeof args.patch === 'string' ? args.patch : '';
  const re = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gm;
  let m;
  while ((m = re.exec(patch)) !== null) out.push(m[1].trim());
  return out;
}

function collectContent(args) {
  const parts = [];
  for (const key of CONTENT_KEYS) if (typeof args[key] === 'string') parts.push(args[key]);
  return parts.join('\n');
}

function commandText(args) {
  for (const key of ['command', 'cmd', 'script', 'input']) if (typeof args[key] === 'string') return args[key];
  return '';
}

// Matched against the command with quotes removed so "approve" / 'git.exe' / "C:\my dir" cannot dodge the patterns.
const GIT_BLOCK = /\bgit(?:\.exe)?\b[^|;&\n]*?\b(commit|push|merge|rebase|reset\s+--hard)\b/i;
const GH_BLOCK = /\bgh(?:\.exe)?\b[^|;&\n]*?\bpr\s+(create|merge|review)\b/i;
const NEVER_OVERRIDDEN = /\bgit(?:\.exe)?\b[^|;&\n]*?\b(merge|rebase|reset\s+--hard)\b|\bgh(?:\.exe)?\b[^|;&\n]*?\bpr\s+(merge|review)\b/i;
const AI_COMMIT_MARKER = /\bAI-Assisted-By:/i;
const DEFAULT_VERDICT_FILE = path.resolve(__dirname, '../../docs/verification-report.md');

// Override: once the final review agent (QA and Verification) records exactly one "Final verdict: APPROVED" line,
// the PR agent may stage, commit, push a feature branch and open a PR to main. Otherwise git/PR actions stay human-only.
function finalReviewApproved(verdictFile) {
  try {
    const verdicts = fs.readFileSync(verdictFile, 'utf8').match(/^Final verdict:.*$/gim) || [];
    return verdicts.length === 1 && /^Final verdict:\s*APPROVED\s*$/i.test(verdicts[0]);
  } catch {
    return false;
  }
}

function gitPublishViolation(command) {
  for (const segment of command.split(/[|;&\n]+/)) {
    const git = /\bgit(?:\.exe)?\b(.*)$/i.exec(segment);
    if (git) {
      const rest = git[1];
      const sub = /\b(commit|push)\b/i.exec(rest);
      if (sub && sub[1].toLowerCase() === 'commit') {
        if (/(^|\s)(--no-verify|-n)(\s|$)/.test(rest)) return 'Commits must run hooks; --no-verify is not allowed.';
        if (!AI_COMMIT_MARKER.test(command)) {
          return 'Agent commits must be labelled: pass -m with an "AI-Assisted-By: <agent name>" trailer in the message.';
        }
      } else if (sub) {
        const tokens = rest.slice(sub.index + sub[0].length).trim().split(/\s+/).filter(Boolean);
        const flags = tokens.filter((t) => t.startsWith('-'));
        const positional = tokens.filter((t) => !t.startsWith('-'));
        if (flags.some((f) => f !== '-u' && f !== '--set-upstream')) return 'Only "git push [-u] origin <feature-branch>" is allowed; no force, delete or other push flags.';
        const [remote, refspec] = positional;
        if (positional.length !== 2 || !/^[\w.-]+$/.test(remote) || !/^[\w][\w./-]*$/.test(refspec)) {
          return 'Push must name the remote and a plain branch: "git push -u origin <feature-branch>".';
        }
        if (/^(main|master|HEAD)$/i.test(refspec)) return 'Pushing to main/master (or bare HEAD) is not allowed; push a feature branch and open a PR.';
      }
    }
    const gh = /\bgh(?:\.exe)?\b(.*)$/i.exec(segment);
    if (gh && /\bpr\s+create\b/i.test(gh[1]) && !/(--base|-B)[\s=]+main\b/.test(gh[1])) {
      return 'Pull requests must target main: use "gh pr create --base main".';
    }
  }
  return null;
}
const APPROVAL_BLOCK = /\b(?:workflow|docs)\s+(?:approve|reject)\b/i;
const WRITE_OPERATOR = /(>>?|\btee\b|set-content|add-content|out-file|remove-item|\brm\b|\bdel\b|\bmv\b|\bmove\b|\bcp\b|\bcopy\b|sed\s+-i|new-item|rename-item)/i;
const PROTECTED_IN_COMMAND = /\.sdlc\b|docs\/approvals\.json|\.github\/hooks|\.env(?!\.example\b)(\.[\w-]+)?\b/i;
// Atlassian MCP write tools: Jira/Confluence changes are human actions; agents get read-only access.
const MCP_WRITE_TOOL = /(createJira|editJira|transitionJira|addOrEditJira|createConfluence|updateConfluence|executeWrite|executeDestructive)/i;

function deny(reason) {
  return { permissionDecision: 'deny', permissionDecisionReason: reason };
}

function evaluate(event, options = {}) {
  if (!event || typeof event !== 'object') return deny('Guardrail could not read the tool event; denying (fail-closed).');
  const toolName = String(event.toolName ?? event.tool_name ?? '');
  const rawArgs = event.toolArgs !== undefined ? event.toolArgs : event.tool_input;
  if (!toolName) return deny('Guardrail could not identify the tool; denying (fail-closed).');
  const args = parseArgs(rawArgs);

  if (MCP_WRITE_TOOL.test(toolName)) {
    return deny('Jira/Confluence writes are human actions; agents have read-only Atlassian access. Ask the human to make the change.');
  }

  if (SHELL_TOOL.test(toolName)) {
    const original = commandText(args);
    const command = original.replace(/["'`]/g, '').replace(/\\/g, '/');
    if (GIT_BLOCK.test(command) || GH_BLOCK.test(command)) {
      if (NEVER_OVERRIDDEN.test(command) || !finalReviewApproved(options.verdictFile || DEFAULT_VERDICT_FILE)) {
        return deny('Commits, pushes, merges and PR creation require the human; ask them to run it (the PR agent may publish only after the final review verdict is APPROVED).');
      }
      const violation = gitPublishViolation(command);
      if (violation) return deny(violation);
    }
    if (APPROVAL_BLOCK.test(command)) {
      return deny('Gate approvals/rejections are human decisions; ask the human to run them in their own terminal.');
    }
    if (WRITE_OPERATOR.test(command) && PROTECTED_IN_COMMAND.test(command)) {
      return deny('Shell write to a protected path blocked (.sdlc, approval ledger, hooks or .env files).');
    }
    if (SECRET_PATTERNS.some((re) => re.test(original))) return deny('Command appears to contain a credential; use environment variables.');
    return {};
  }

  if (WRITE_TOOL.test(toolName)) {
    for (const p of collectPaths(args)) {
      const reason = protectedReason(p);
      if (reason) return deny(`Edit to "${p}" blocked: ${reason}.`);
    }
    if (SECRET_PATTERNS.some((re) => re.test(collectContent(args)))) {
      return deny('Content appears to contain a credential; use environment variables and .env.example placeholders.');
    }
  }
  return {};
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    let result;
    try {
      result = evaluate(JSON.parse(raw));
    } catch {
      result = deny('Guardrail could not parse the tool event; denying (fail-closed).');
    }
    process.stdout.write(JSON.stringify(result));
  });
}

module.exports = { evaluate };
if (require.main === module) main();

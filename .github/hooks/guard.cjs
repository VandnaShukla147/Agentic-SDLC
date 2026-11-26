'use strict';
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
const GH_BLOCK = /\bgh(?:\.exe)?\b[^|;&\n]*?\bpr\s+(create|merge)\b/i;
const APPROVAL_BLOCK = /\b(?:workflow|docs)\s+(?:approve|reject)\b/i;
const WRITE_OPERATOR = /(>>?|\btee\b|set-content|add-content|out-file|remove-item|\brm\b|\bdel\b|\bmv\b|\bmove\b|\bcp\b|\bcopy\b|sed\s+-i|new-item|rename-item)/i;
const PROTECTED_IN_COMMAND = /\.sdlc\b|docs\/approvals\.json|\.github\/hooks|\.env(?!\.example\b)(\.[\w-]+)?\b/i;

function deny(reason) {
  return { permissionDecision: 'deny', permissionDecisionReason: reason };
}

function evaluate(event) {
  if (!event || typeof event !== 'object') return deny('Guardrail could not read the tool event; denying (fail-closed).');
  const toolName = String(event.toolName ?? event.tool_name ?? '');
  const rawArgs = event.toolArgs !== undefined ? event.toolArgs : event.tool_input;
  if (!toolName) return deny('Guardrail could not identify the tool; denying (fail-closed).');
  const args = parseArgs(rawArgs);

  if (SHELL_TOOL.test(toolName)) {
    const original = commandText(args);
    const command = original.replace(/["'`]/g, '').replace(/\\/g, '/');
    if (GIT_BLOCK.test(command) || GH_BLOCK.test(command)) {
      return deny('Commits, pushes, merges and PR creation require the human; ask them to run it.');
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

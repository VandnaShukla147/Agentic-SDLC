const PLACEHOLDER = /^YOUR_.*_HERE$/;

const SECRET_NAME = /(TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)/i;

const SECRET_PATTERNS: RegExp[] = [
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]{8,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];

export const REDACTED = '[REDACTED]';

export function isPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value.trim());
}

/** Masks secret environment values and well-known credential patterns in text. */
export function redact(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let result = text;
  for (const [name, value] of Object.entries(env)) {
    if (!value || value.length < 4 || isPlaceholder(value) || !SECRET_NAME.test(name)) continue;
    result = result.split(value).join(REDACTED);
  }
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

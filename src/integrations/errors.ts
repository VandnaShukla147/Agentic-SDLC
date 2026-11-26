export type ErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_ID'
  | 'MISSING_FIELDS'
  | 'MALFORMED'
  | 'SOURCE_UNAVAILABLE'
  | 'AUTH_FAILED'
  | 'UNSAFE_PATH'
  | 'WORKFLOW'
  | 'CONFIG';

export interface StoryError {
  code: ErrorCode;
  message: string;
  fields?: string[];
}

export type Result<T, E = StoryError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err(code: ErrorCode, message: string, fields?: string[]): Result<never, StoryError> {
  const error: StoryError = fields && fields.length > 0 ? { code, message, fields } : { code, message };
  return { ok: false, error };
}

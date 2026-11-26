import { redact } from './redact.js';

export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export type LogSink = (level: LogLevel, line: string) => void;

const defaultSink: LogSink = (level, line) => {
  if (level === 'info') console.log(line);
  else console.error(line);
};

/** Logger that redacts secrets from every message before it reaches the sink. */
export function createLogger(env: NodeJS.ProcessEnv = process.env, sink: LogSink = defaultSink): Logger {
  const emit = (level: LogLevel) => (message: string) => sink(level, redact(message, env));
  return { info: emit('info'), warn: emit('warn'), error: emit('error') };
}

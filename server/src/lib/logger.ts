import { config } from '../config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

function enabled(level: keyof typeof LEVELS): boolean {
  return LEVELS[level] >= LEVELS[config.logLevel];
}

function emit(level: keyof typeof LEVELS, msg: string, meta?: Record<string, unknown>) {
  if (!enabled(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
  child: (base: Record<string, unknown>) => ({
    debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, { ...base, ...meta }),
    info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, { ...base, ...meta }),
    warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, { ...base, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, { ...base, ...meta }),
  }),
};

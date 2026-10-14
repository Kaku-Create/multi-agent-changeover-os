import path from 'node:path';

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '0.0.0.0',
  port: num(process.env.PORT, 3001),
  dataDir: process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data'),
  dbFile: process.env.DB_FILE ?? 'changeover.db',
  logLevel: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  seedOnEmpty: bool(process.env.SEED_ON_EMPTY, true),
  seed: num(process.env.SEED, 20261002),
  rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: num(process.env.RATE_LIMIT_MAX, 600),
  liveTickMs: num(process.env.LIVE_TICK_MS, 3000),
  enableLiveSimulator: bool(process.env.ENABLE_LIVE_SIMULATOR, true),
  shutdownTimeoutMs: num(process.env.SHUTDOWN_TIMEOUT_MS, 10_000),
  version: '2.0.0',
};

export const dbPath = path.isAbsolute(config.dbFile)
  ? config.dbFile
  : path.join(config.dataDir, config.dbFile);

export type AppConfig = typeof config;

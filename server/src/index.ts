import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { getDb, closeDb } from './store/db.js';
import { seedIfEmpty } from './runtime/bootstrap.js';
import { startLiveSimulator, stopLiveSimulator } from './runtime/liveSimulator.js';
import { repository } from './store/repository.js';

function bootstrap() {
  getDb();
  if (config.seedOnEmpty) {
    seedIfEmpty();
  } else if (repository.isEmpty()) {
    logger.warn('database is empty and SEED_ON_EMPTY=false; import data to proceed');
  }
}

function main() {
  bootstrap();
  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    logger.info('server started', {
      host: config.host,
      port: config.port,
      env: config.env,
      version: config.version,
    });
  });
  startLiveSimulator();

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutdown initiated', { signal });
    stopLiveSimulator();
    const timer = setTimeout(() => {
      logger.error('shutdown timeout, forcing exit');
      process.exit(1);
    }, config.shutdownTimeoutMs);
    if (timer.unref) timer.unref();

    server.close(() => {
      closeDb();
      logger.info('shutdown complete');
      clearTimeout(timer);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', { message: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
}

main();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { requestId, requestLogger, auditLogger } from './lib/middleware.js';
import { errorHandler, notFoundHandler } from './lib/http.js';
import apiRouter from './routes/api.js';
import importRouter from './routes/import.js';
import streamRouter from './routes/stream.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()) }));
  app.use(requestId);
  app.use(requestLogger);

  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.originalUrl.startsWith('/api/stream'),
    message: { error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试' } },
  });
  app.use('/api', limiter);

  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ type: ['text/csv', 'text/plain', 'text/tab-separated-values'], limit: '10mb' }));
  app.use(auditLogger);

  app.use('/api', apiRouter);
  app.use('/api/import', importRouter);
  app.use('/api/stream', streamRouter);

  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist, { maxAge: '1h', index: 'index.html' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export { __dirname };

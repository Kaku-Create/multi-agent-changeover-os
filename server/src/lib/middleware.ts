import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger.js';
import { repository } from '../store/repository.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('http', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
    });
  });
  next();
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function auditLogger(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING.has(req.method) || !req.path.startsWith('/api')) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    try {
      repository.audit({
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        ip: req.ip,
      });
    } catch (err) {
      logger.warn('audit write failed', { message: err instanceof Error ? err.message : String(err) });
    }
  });
  next();
}

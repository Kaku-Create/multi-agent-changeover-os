import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors.js';
import { logger } from './logger.js';

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', `接口不存在: ${req.method} ${req.path}`));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = (req as Request & { requestId?: string }).requestId;
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error('request failed', { requestId, code: err.code, message: err.message });
    } else {
      logger.warn('request rejected', { requestId, code: err.code, message: err.message });
    }
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
      requestId,
    });
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error('unhandled error', { requestId, message });
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
    requestId,
  });
}

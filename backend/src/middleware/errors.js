import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'The requested endpoint does not exist.'));
}

export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;
  const status = error instanceof ZodError ? 400 : (error.statusCode ?? 500);
  const code = error instanceof ZodError ? 'VALIDATION_ERROR' : (error.code ?? 'INTERNAL_ERROR');
  const message = error instanceof ZodError ? 'Request validation failed.' : (status >= 500 ? 'An unexpected server error occurred.' : error.message);
  logger.error({ requestId: req.id, code, status, method: req.method, path: req.path, err: status >= 500 ? error : undefined }, 'request_failed');
  const body = { error: { code, message, requestId: req.id } };
  if (error instanceof ZodError) body.error.details = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  if (env.NODE_ENV !== 'production' && error instanceof HttpError && error.details) body.error.details = error.details;
  res.status(status).json(body);
}

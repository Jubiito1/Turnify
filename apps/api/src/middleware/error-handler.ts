import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((error as { code: string }).code)
  );
}

function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Ruta no encontrada'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (isBodyParserError(error)) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 400;
    res.status(status).json({
      error: {
        code: error.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_BODY',
        message: 'El cuerpo de la solicitud no es válido',
      },
    });
    return;
  }

  if (isPrismaKnownError(error)) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } });
      return;
    }
    if (error.code === 'P2002') {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'El recurso ya existe' } });
      return;
    }
  }

  logger.error({ err: error, path: req.path, method: req.method }, 'Unhandled error');
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' } });
};

/**
 * Domain/application error with a stable machine-readable code (see docs/SPEC.md).
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthenticated = (message = 'Necesitas iniciar sesión') =>
  new AppError(401, 'UNAUTHENTICATED', message);

export const forbidden = (message = 'No tienes permiso para realizar esta acción') =>
  new AppError(403, 'FORBIDDEN', message);

export const permissionDenied = (message: string) =>
  new AppError(403, 'PERMISSION_DENIED', message);

export const notFound = (message = 'Recurso no encontrado') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);

export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);

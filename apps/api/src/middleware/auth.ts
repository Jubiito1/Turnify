import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@prisma/client';
import { forbidden, unauthenticated } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { SESSION_COOKIE, verifySessionToken } from '../modules/auth/session';

export interface AuthContext {
  userId: string;
  role: Role;
  /** Business owned by an ADMIN; derived server-side, never from client input (RN-011). */
  businessId: string | null;
  professional: {
    id: string;
    businessId: string;
    isActive: boolean;
    canManageBlocks: boolean;
    canCompleteBookings: boolean;
  } | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

async function loadAuthContext(req: Request): Promise<AuthContext | null> {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length === 0) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  // Always reload from the database so role/permission changes apply immediately.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      role: true,
      ownedBusiness: { select: { id: true } },
      professional: {
        select: {
          id: true,
          businessId: true,
          isActive: true,
          canManageBlocks: true,
          canCompleteBookings: true,
        },
      },
    },
  });
  if (!user) return null;

  return {
    userId: user.id,
    role: user.role,
    businessId: user.role === 'ADMIN' ? (user.ownedBusiness?.id ?? null) : null,
    professional: user.role === 'PROFESSIONAL' ? user.professional : null,
  };
}

/** Requires a valid session (RN-024). */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const auth = await loadAuthContext(req);
  if (!auth) throw unauthenticated();
  req.auth = auth;
  next();
};

/** Attaches the session when present without requiring it. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  req.auth = (await loadAuthContext(req)) ?? undefined;
  next();
};

/** Requires one of the given roles; must run after `authenticate` (RN-024). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw unauthenticated();
    if (!roles.includes(req.auth.role)) throw forbidden();
    next();
  };
}

/** Returns the authenticated context or fails; for use inside handlers after `authenticate`. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}

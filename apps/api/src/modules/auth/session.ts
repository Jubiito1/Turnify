import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env, isProduction } from '../../config/env';

export const SESSION_COOKIE = 'turnify_session';

interface SessionPayload {
  sub: string;
  role: Role;
}

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  // Lax blocks the cookie on cross-site POSTs (CSRF) while allowing normal navigation.
  // In production the web app proxies /api, so the cookie is always first-party.
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
});

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${env.SESSION_TTL_DAYS}d`,
  });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || typeof decoded.sub !== 'string') return null;
    return { sub: decoded.sub, role: decoded.role as Role };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, payload: SessionPayload): void {
  res.cookie(SESSION_COOKIE, signSessionToken(payload), {
    ...cookieOptions(),
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

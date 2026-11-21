import { Router, type RequestHandler } from 'express';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '@turnify/shared';
import { parse } from '../../lib/validate';
import { authenticate, getAuth } from '../../middleware/auth';
import * as authService from './auth.service';
import { clearSessionCookie, setSessionCookie } from './session';

export function createAuthRouter(authRateLimiter: RequestHandler) {
  const router = Router();

  router.post('/register', authRateLimiter, async (req, res) => {
    const input = parse(registerSchema, req.body);
    const user = await authService.registerClient(input);
    setSessionCookie(res, { sub: user.id, role: user.role });
    res.status(201).json({ user });
  });

  router.post('/login', authRateLimiter, async (req, res) => {
    const input = parse(loginSchema, req.body);
    const user = await authService.login(input);
    setSessionCookie(res, { sub: user.id, role: user.role });
    res.json({ user });
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', authenticate, async (req, res) => {
    res.json({ user: await authService.getSessionUser(getAuth(req).userId) });
  });

  router.patch('/me', authenticate, async (req, res) => {
    const input = parse(updateProfileSchema, req.body);
    res.json({ user: await authService.updateProfile(getAuth(req).userId, input) });
  });

  router.post('/me/password', authenticate, async (req, res) => {
    const input = parse(changePasswordSchema, req.body);
    await authService.changePassword(getAuth(req).userId, input);
    res.status(204).end();
  });

  return router;
}

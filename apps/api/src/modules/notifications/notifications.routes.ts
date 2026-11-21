import { Router } from 'express';
import { notificationListQuerySchema } from '@turnify/shared';
import { parse, parseId } from '../../lib/validate';
import { getAuth } from '../../middleware/auth';
import * as notifications from './notifications.service';

/** Mounted under /api/notifications (any authenticated user, own notifications only). */
export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res) => {
  const { unreadOnly } = parse(notificationListQuerySchema, req.query);
  res.json(await notifications.listNotifications(getAuth(req).userId, unreadOnly));
});

notificationsRouter.post('/read-all', async (req, res) => {
  await notifications.markAllRead(getAuth(req).userId);
  res.status(204).end();
});

notificationsRouter.post('/:id/read', async (req, res) => {
  await notifications.markRead(getAuth(req).userId, parseId(req.params.id));
  res.status(204).end();
});

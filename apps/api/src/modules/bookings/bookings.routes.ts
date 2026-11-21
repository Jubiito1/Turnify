import { Router, type Request } from 'express';
import {
  adminCreateBookingSchema,
  cancelBookingSchema,
  createBookingSchema,
  rescheduleBookingSchema,
  updateBookingStatusSchema,
} from '@turnify/shared';
import { parse, parseId } from '../../lib/validate';
import { getAdminBusinessId, getAuth, getProfessionalContext } from '../../middleware/auth';
import * as lifecycle from './booking-lifecycle.service';
import * as bookingService from './booking.service';

function adminActor(req: Request) {
  return {
    kind: 'admin' as const,
    userId: getAuth(req).userId,
    businessId: getAdminBusinessId(req),
  };
}

/** Client bookings, mounted under /api/bookings (CLIENT role). */
export const clientBookingsRouter = Router();

clientBookingsRouter.post('/', async (req, res) => {
  const input = parse(createBookingSchema, req.body);
  const booking = await bookingService.createClientBooking(getAuth(req).userId, input);
  res.status(201).json({ booking });
});

clientBookingsRouter.get('/:id', async (req, res) => {
  const booking = await bookingService.getClientBooking(
    getAuth(req).userId,
    parseId(req.params.id),
  );
  res.json({ booking });
});

clientBookingsRouter.post('/:id/cancel', async (req, res) => {
  const input = parse(cancelBookingSchema, req.body ?? {});
  const booking = await lifecycle.cancelAsClient(
    getAuth(req).userId,
    parseId(req.params.id),
    input.reason,
  );
  res.json({ booking });
});

clientBookingsRouter.post('/:id/reschedule', async (req, res) => {
  const input = parse(rescheduleBookingSchema, req.body);
  const booking = await lifecycle.reschedule(
    { kind: 'client', userId: getAuth(req).userId },
    parseId(req.params.id),
    // Clients cannot pick another professional when rescheduling.
    { startsAt: input.startsAt },
  );
  res.json({ booking });
});

/** Admin bookings, mounted under /api/admin/bookings. */
export const adminBookingsRouter = Router();

adminBookingsRouter.post('/', async (req, res) => {
  const input = parse(adminCreateBookingSchema, req.body);
  const booking = await bookingService.createAdminBooking(getAdminBusinessId(req), input);
  res.status(201).json({ booking });
});

adminBookingsRouter.patch('/:id/status', async (req, res) => {
  const input = parse(updateBookingStatusSchema, req.body);
  const booking = await lifecycle.updateStatus(adminActor(req), parseId(req.params.id), input);
  res.json({ booking });
});

adminBookingsRouter.post('/:id/reschedule', async (req, res) => {
  const input = parse(rescheduleBookingSchema, req.body);
  const booking = await lifecycle.reschedule(adminActor(req), parseId(req.params.id), input);
  res.json({ booking });
});

/** Professional panel bookings, mounted under /api/pro/bookings. */
export const proBookingsRouter = Router();

proBookingsRouter.patch('/:id/status', async (req, res) => {
  const professional = getProfessionalContext(req);
  const input = parse(updateBookingStatusSchema, req.body);
  const booking = await lifecycle.updateStatus(
    {
      kind: 'professional',
      userId: getAuth(req).userId,
      professionalId: professional.id,
      canCompleteBookings: professional.canCompleteBookings,
    },
    parseId(req.params.id),
    input,
  );
  res.json({ booking });
});

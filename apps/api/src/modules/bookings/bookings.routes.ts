import { Router } from 'express';
import { adminCreateBookingSchema, createBookingSchema } from '@turnify/shared';
import { parse, parseId } from '../../lib/validate';
import { getAdminBusinessId, getAuth } from '../../middleware/auth';
import * as bookingService from './booking.service';

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

/** Admin bookings, mounted under /api/admin/bookings. */
export const adminBookingsRouter = Router();

adminBookingsRouter.post('/', async (req, res) => {
  const input = parse(adminCreateBookingSchema, req.body);
  const booking = await bookingService.createAdminBooking(getAdminBusinessId(req), input);
  res.status(201).json({ booking });
});

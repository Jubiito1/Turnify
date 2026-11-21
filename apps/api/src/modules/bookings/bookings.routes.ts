import { Router, type Request } from 'express';
import {
  adminCreateBookingSchema,
  bookingListQuerySchema,
  cancelBookingSchema,
  clientBookingListQuerySchema,
  clientListQuerySchema,
  createBookingSchema,
  dateRangeQuerySchema,
  rescheduleBookingSchema,
  updateBookingStatusSchema,
} from '@turnify/shared';
import { parse, parseId } from '../../lib/validate';
import { getAdminBusinessId, getAuth, getProfessionalContext } from '../../middleware/auth';
import * as lifecycle from './booking-lifecycle.service';
import * as queries from './booking-queries.service';
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

clientBookingsRouter.get('/', async (req, res) => {
  const query = parse(clientBookingListQuerySchema, req.query);
  res.json(await queries.listClientBookings(getAuth(req).userId, query));
});

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

adminBookingsRouter.get('/', async (req, res) => {
  const query = parse(bookingListQuerySchema, req.query);
  res.json(await queries.listAdminBookings(getAdminBusinessId(req), query));
});

adminBookingsRouter.get('/calendar', async (req, res) => {
  const query = parse(dateRangeQuerySchema, req.query);
  res.json({ items: await queries.listCalendar(getAdminBusinessId(req), query) });
});

adminBookingsRouter.get('/export.csv', async (req, res) => {
  const { page: _page, pageSize: _pageSize, ...filters } = parse(bookingListQuerySchema, req.query);
  const csv = await queries.exportBookingsCsv(getAdminBusinessId(req), filters);
  res
    .status(200)
    .type('text/csv; charset=utf-8')
    .attachment(`reservas-${new Date().toISOString().slice(0, 10)}.csv`)
    .send(csv);
});

adminBookingsRouter.post('/', async (req, res) => {
  const input = parse(adminCreateBookingSchema, req.body);
  const booking = await bookingService.createAdminBooking(getAdminBusinessId(req), input);
  res.status(201).json({ booking });
});

adminBookingsRouter.get('/:id', async (req, res) => {
  const booking = await queries.getAdminBooking(getAdminBusinessId(req), parseId(req.params.id));
  res.json({ booking });
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

/** Admin clients list, mounted under /api/admin/clients. */
export const adminClientsRouter = Router();

adminClientsRouter.get('/', async (req, res) => {
  const query = parse(clientListQuerySchema, req.query);
  res.json(await queries.listClients(getAdminBusinessId(req), query));
});

/** Professional panel bookings, mounted under /api/pro/bookings. */
export const proBookingsRouter = Router();

proBookingsRouter.get('/', async (req, res) => {
  const professional = getProfessionalContext(req);
  const query = parse(bookingListQuerySchema, req.query);
  res.json(await queries.listProfessionalBookings(professional.id, query));
});

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

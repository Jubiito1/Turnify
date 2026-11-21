-- Integrity constraints that Prisma's schema language cannot express.
-- See docs/SPEC.md and docs/ARCHITECTURE.md ("Concurrencia").

-- btree_gist lets a GiST index combine equality on uuid with range overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- RN-031: emails are stored normalized to lowercase.
ALTER TABLE "User"
  ADD CONSTRAINT "user_email_lowercase_chk" CHECK ("email" = lower("email"));

-- RN-013, RN-027, RN-034: business policy ranges.
ALTER TABLE "Business"
  ADD CONSTRAINT "business_cancellation_hours_chk" CHECK ("cancellationMinHours" BETWEEN 0 AND 168),
  ADD CONSTRAINT "business_slot_interval_chk" CHECK ("slotIntervalMinutes" IN (5, 10, 15, 20, 30, 60)),
  ADD CONSTRAINT "business_horizon_days_chk" CHECK ("bookingHorizonDays" BETWEEN 1 AND 365),
  ADD CONSTRAINT "business_slug_format_chk" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- RN-007, RN-018: positive duration, non-negative integer cents.
ALTER TABLE "Service"
  ADD CONSTRAINT "service_duration_chk" CHECK ("durationMinutes" > 0 AND "durationMinutes" <= 480),
  ADD CONSTRAINT "service_price_chk" CHECK ("priceCents" >= 0);

-- RN-030: valid weekly working ranges.
ALTER TABLE "WorkingHours"
  ADD CONSTRAINT "working_hours_weekday_chk" CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "working_hours_range_chk" CHECK ("startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440);

-- RN-030: no overlapping ranges for the same professional and weekday.
ALTER TABLE "WorkingHours"
  ADD CONSTRAINT "working_hours_no_overlap" EXCLUDE USING gist (
    "professionalId" WITH =,
    "weekday" WITH =,
    int4range("startMinute", "endMinute", '[)') WITH &&
  );

ALTER TABLE "TimeBlock"
  ADD CONSTRAINT "time_block_range_chk" CHECK ("startsAt" < "endsAt");

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_range_chk" CHECK ("startsAt" < "endsAt"),
  ADD CONSTRAINT "booking_price_chk" CHECK ("priceCents" >= 0);

-- RN-006, RN-012, RN-020: two active bookings of the same professional can never overlap.
-- Half-open ranges allow back-to-back appointments. Cancelled/completed bookings are excluded.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap" EXCLUDE USING gist (
    "professionalId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));

-- RN-028: a client cannot hold two overlapping active bookings (in any business).
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_client_no_overlap" EXCLUDE USING gist (
    "clientId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));

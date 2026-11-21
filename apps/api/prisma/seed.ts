/**
 * Demo data for Turnify. Creates businesses, services, professionals, clients and bookings
 * relative to the current date so the demo always shows recent history and upcoming agenda.
 *
 * Safety: refuses to touch a database that already has data unless SEED_RESET=true.
 * Demo credentials are intentionally public (see README) and only valid for this demo data.
 */
import { fileURLToPath } from 'node:url';
import {
  PrismaClient,
  type BookingStatus,
  type BusinessCategory,
  type NotificationType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { DateTime } from 'luxon';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const prisma = new PrismaClient();
export const DEMO_PASSWORD = 'Demo1234';

/** Deterministic PRNG so every seed run produces the same shape of data. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261231);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

interface ServiceSeed {
  key: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  isActive?: boolean;
}

interface ProfessionalSeed {
  displayName: string;
  bio: string;
  services: string[];
  /** [weekday, startMinute, endMinute] in business local time (0 = Sunday). */
  hours: [number, number, number][];
  account?: { email: string; name: string };
  canManageBlocks?: boolean;
}

interface BusinessSeed {
  name: string;
  slug: string;
  category: BusinessCategory;
  description: string;
  address: string;
  phone: string;
  timezone: string;
  cancellationMinHours: number;
  slotIntervalMinutes: number;
  autoConfirm: boolean;
  owner: { email: string; name: string };
  services: ServiceSeed[];
  professionals: ProfessionalSeed[];
}

const weekdays = (days: number[], start: number, end: number): [number, number, number][] =>
  days.map((d) => [d, start, end]);
const h = (hours: number, minutes = 0) => hours * 60 + minutes;

const BUSINESSES: BusinessSeed[] = [
  {
    name: 'Estudio Lumen',
    slug: 'estudio-lumen',
    category: 'BEAUTY',
    description:
      'Peluquería y estética integral. Cortes, color, manos y tratamientos faciales con productos veganos.',
    address: 'Gurruchaga 1450, Palermo, CABA',
    phone: '+54 11 4833-1450',
    timezone: 'America/Argentina/Buenos_Aires',
    cancellationMinHours: 12,
    slotIntervalMinutes: 15,
    autoConfirm: false,
    owner: { email: 'admin@turnify.demo', name: 'Valeria Sosa' },
    services: [
      {
        key: 'cut',
        name: 'Corte y peinado',
        description: 'Lavado, corte personalizado y peinado.',
        durationMinutes: 45,
        priceCents: 1800000,
      },
      {
        key: 'color',
        name: 'Coloración completa',
        description: 'Color de raíz a puntas con matización.',
        durationMinutes: 120,
        priceCents: 4500000,
      },
      {
        key: 'brushing',
        name: 'Brushing',
        description: 'Lavado y brushing con protector térmico.',
        durationMinutes: 30,
        priceCents: 900000,
      },
      {
        key: 'nails',
        name: 'Manicuría semipermanente',
        description: 'Esmaltado semipermanente con limado y cutículas.',
        durationMinutes: 60,
        priceCents: 1500000,
      },
      {
        key: 'facial',
        name: 'Limpieza facial profunda',
        description: 'Limpieza, exfoliación e hidratación.',
        durationMinutes: 60,
        priceCents: 2200000,
      },
      {
        key: 'keratin',
        name: 'Alisado con keratina',
        description: 'Servicio pausado temporalmente.',
        durationMinutes: 150,
        priceCents: 6000000,
        isActive: false,
      },
    ],
    professionals: [
      {
        displayName: 'Lucía Fernández',
        bio: 'Colorista con 10 años de experiencia. Especialista en balayage.',
        services: ['cut', 'color', 'brushing'],
        hours: [
          ...weekdays([1, 2, 3, 4, 5], h(9), h(13)),
          ...weekdays([1, 2, 3, 4, 5], h(14), h(18)),
          [6, h(9), h(13)],
        ],
        account: { email: 'pro@turnify.demo', name: 'Lucía Fernández' },
        canManageBlocks: true,
      },
      {
        displayName: 'Martín Paz',
        bio: 'Cortes modernos y peinados para eventos.',
        services: ['cut', 'brushing', 'keratin'],
        hours: [...weekdays([2, 3, 4, 5], h(11), h(20)), [6, h(10), h(16)]],
      },
      {
        displayName: 'Camila Ríos',
        bio: 'Cosmetóloga y manicura. Atención personalizada.',
        services: ['nails', 'facial'],
        hours: weekdays([1, 2, 3, 4, 5, 6], h(10), h(18)),
      },
    ],
  },
  {
    name: 'Barbería Don Ramiro',
    slug: 'barberia-don-ramiro',
    category: 'BARBERSHOP',
    description:
      'Barbería clásica de barrio: cortes, barba y afeitado a navaja con toalla caliente.',
    address: 'Av. San Juan 2210, San Cristóbal, CABA',
    phone: '+54 11 4941-2210',
    timezone: 'America/Argentina/Buenos_Aires',
    cancellationMinHours: 2,
    slotIntervalMinutes: 30,
    autoConfirm: true,
    owner: { email: 'barberia@turnify.demo', name: 'Ramiro Gómez' },
    services: [
      {
        key: 'classic',
        name: 'Corte clásico',
        description: 'Corte a tijera o máquina.',
        durationMinutes: 30,
        priceCents: 800000,
      },
      {
        key: 'beard',
        name: 'Corte + barba',
        description: 'Corte y perfilado de barba.',
        durationMinutes: 60,
        priceCents: 1100000,
      },
      {
        key: 'shave',
        name: 'Afeitado tradicional',
        description: 'Navaja, toalla caliente y aftershave.',
        durationMinutes: 30,
        priceCents: 700000,
      },
    ],
    professionals: [
      {
        displayName: 'Ramiro Gómez',
        bio: 'Fundador. 25 años detrás de la silla.',
        services: ['classic', 'beard', 'shave'],
        hours: weekdays([2, 3, 4, 5, 6], h(10), h(20)),
      },
      {
        displayName: 'Nico Benítez',
        bio: 'Degradés y diseños.',
        services: ['classic', 'beard'],
        hours: weekdays([2, 3, 4, 5, 6], h(12), h(20)),
      },
    ],
  },
  {
    name: 'Kinesio Vital',
    slug: 'kinesio-vital',
    category: 'HEALTH',
    description: 'Centro de kinesiología y rehabilitación deportiva. Atendemos con turno previo.',
    address: 'Bv. San Juan 640, Córdoba',
    phone: '+54 351 422-0640',
    timezone: 'America/Argentina/Cordoba',
    cancellationMinHours: 24,
    slotIntervalMinutes: 30,
    autoConfirm: false,
    owner: { email: 'kinesio@turnify.demo', name: 'Paula Méndez' },
    services: [
      {
        key: 'eval',
        name: 'Evaluación inicial',
        description: 'Primera consulta y plan de tratamiento.',
        durationMinutes: 30,
        priceCents: 1200000,
      },
      {
        key: 'session',
        name: 'Sesión de kinesiología',
        description: 'Sesión de rehabilitación.',
        durationMinutes: 45,
        priceCents: 2000000,
      },
      {
        key: 'massage',
        name: 'Masaje descontracturante',
        description: 'Masaje terapéutico de 60 minutos.',
        durationMinutes: 60,
        priceCents: 2500000,
      },
    ],
    professionals: [
      {
        displayName: 'Lic. Paula Méndez',
        bio: 'Kinesióloga deportiva (MP 4521).',
        services: ['eval', 'session'],
        hours: weekdays([1, 2, 3, 4, 5], h(8), h(14)),
      },
      {
        displayName: 'Lic. Tomás Acosta',
        bio: 'Rehabilitación y terapia manual.',
        services: ['eval', 'session', 'massage'],
        hours: weekdays([1, 2, 3, 4, 5], h(14), h(20)),
      },
    ],
  },
  {
    name: 'Huellitas Pet Spa',
    slug: 'huellitas-pet-spa',
    category: 'PETS',
    description: 'Baño, corte y cuidado para perros y gatos, sin jaulas ni sedantes.',
    address: 'Av. Cabildo 3120, Núñez, CABA',
    phone: '+54 11 4702-3120',
    timezone: 'America/Argentina/Buenos_Aires',
    cancellationMinHours: 24,
    slotIntervalMinutes: 30,
    autoConfirm: false,
    owner: { email: 'huellitas@turnify.demo', name: 'Sofía Luna' },
    services: [
      {
        key: 'bath',
        name: 'Baño y secado',
        description: 'Baño con shampoo hipoalergénico y secado.',
        durationMinutes: 60,
        priceCents: 1400000,
      },
      {
        key: 'groom',
        name: 'Corte de raza',
        description: 'Baño más corte según estándar de raza.',
        durationMinutes: 90,
        priceCents: 2300000,
      },
    ],
    professionals: [
      {
        displayName: 'Sofía Luna',
        bio: 'Peluquera canina certificada.',
        services: ['bath', 'groom'],
        hours: weekdays([1, 2, 3, 4, 5, 6], h(9), h(17)),
      },
    ],
  },
];

const CLIENTS = [
  { email: 'cliente@turnify.demo', name: 'Juan Pérez', phone: '+54 11 5555-0101' },
  { email: 'sofia.martinez@turnify.demo', name: 'Sofía Martínez', phone: '+54 11 5555-0102' },
  { email: 'diego.lopez@turnify.demo', name: 'Diego López', phone: null },
  { email: 'carla.romero@turnify.demo', name: 'Carla Romero', phone: '+54 11 5555-0104' },
  { email: 'mateo.silva@turnify.demo', name: 'Mateo Silva', phone: null },
  { email: 'valentina.gil@turnify.demo', name: 'Valentina Gil', phone: '+54 11 5555-0106' },
  { email: 'lucas.vera@turnify.demo', name: 'Lucas Vera', phone: null },
  { email: 'ana.torres@turnify.demo', name: 'Ana Torres', phone: '+54 351 555-0108' },
  { email: 'bruno.castro@turnify.demo', name: 'Bruno Castro', phone: null },
];

async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Notification", "Booking", "TimeBlock", "WorkingHours", "ProfessionalService", "Professional", "Service", "Business", "User" CASCADE',
  );
}

async function main() {
  const existing = await prisma.business.count();
  if (existing > 0 && process.env.SEED_RESET !== 'true') {
    console.warn(
      `Database already has ${existing} businesses. Set SEED_RESET=true to wipe and reseed.`,
    );
    return;
  }
  await resetDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = DateTime.now();

  const clients = await Promise.all(
    CLIENTS.map((c) => prisma.user.create({ data: { ...c, passwordHash, role: 'CLIENT' } })),
  );
  const demoClient = clients[0]!;
  /** Active intervals per client to respect RN-028 while generating bookings. */
  const clientAgenda = new Map<string, [number, number][]>();

  let bookingCount = 0;

  for (const seed of BUSINESSES) {
    const owner = await prisma.user.create({
      data: { email: seed.owner.email, name: seed.owner.name, passwordHash, role: 'ADMIN' },
    });
    const business = await prisma.business.create({
      data: {
        ownerId: owner.id,
        name: seed.name,
        slug: seed.slug,
        category: seed.category,
        description: seed.description,
        address: seed.address,
        phone: seed.phone,
        timezone: seed.timezone,
        cancellationMinHours: seed.cancellationMinHours,
        slotIntervalMinutes: seed.slotIntervalMinutes,
        autoConfirm: seed.autoConfirm,
        bookingHorizonDays: 60,
      },
    });

    const services = new Map<
      string,
      { id: string; durationMinutes: number; priceCents: number; isActive: boolean }
    >();
    for (const s of seed.services) {
      const created = await prisma.service.create({
        data: {
          businessId: business.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          priceCents: s.priceCents,
          isActive: s.isActive ?? true,
        },
      });
      services.set(s.key, created);
    }

    for (const p of seed.professionals) {
      const user = p.account
        ? await prisma.user.create({
            data: {
              email: p.account.email,
              name: p.account.name,
              passwordHash,
              role: 'PROFESSIONAL',
            },
          })
        : null;
      const professional = await prisma.professional.create({
        data: {
          businessId: business.id,
          userId: user?.id,
          displayName: p.displayName,
          bio: p.bio,
          canManageBlocks: p.canManageBlocks ?? false,
          canCompleteBookings: true,
          services: { create: p.services.map((key) => ({ serviceId: services.get(key)!.id })) },
          workingHours: {
            create: p.hours.map(([weekday, startMinute, endMinute]) => ({
              weekday,
              startMinute,
              endMinute,
            })),
          },
        },
      });

      // One upcoming block per professional (training / errands), 6 days ahead.
      const blockDay = now.setZone(seed.timezone).plus({ days: 6 }).startOf('day');
      const blockRange = p.hours.find(([weekday]) => weekday === blockDay.weekday % 7);
      const blocks: [number, number][] = [];
      if (blockRange) {
        const blockStart = blockDay.plus({ minutes: blockRange[1] });
        const blockEnd = blockStart.plus({ hours: 2 });
        await prisma.timeBlock.create({
          data: {
            professionalId: professional.id,
            startsAt: blockStart.toJSDate(),
            endsAt: blockEnd.toJSDate(),
            reason: 'Capacitación',
            createdById: owner.id,
          },
        });
        blocks.push([blockStart.toMillis(), blockEnd.toMillis()]);
      }

      const offeredServices = p.services.map((key) => services.get(key)!).filter((s) => s.isActive);

      for (let dayOffset = -28; dayOffset <= 14; dayOffset++) {
        const day = now.setZone(seed.timezone).plus({ days: dayOffset }).startOf('day');
        const ranges = p.hours.filter(([weekday]) => weekday === day.weekday % 7);
        for (const [, startMinute, endMinute] of ranges) {
          let cursor = startMinute;
          while (cursor < endMinute) {
            const service = pick(offeredServices);
            const start = day.plus({ minutes: cursor });
            const end = start.plus({ minutes: service.durationMinutes });
            const fits = cursor + service.durationMinutes <= endMinute;
            const blocked = blocks.some(([bs, be]) => start.toMillis() < be && bs < end.toMillis());
            const occupancy = dayOffset < 0 ? 0.55 : 0.35;

            if (!fits || blocked || random() > occupancy) {
              cursor += seed.slotIntervalMinutes;
              continue;
            }

            // Bias the demo client so its account has a rich history.
            const candidates =
              random() < 0.22 ? [demoClient, ...clients] : [...clients].sort(() => random() - 0.5);
            const client = candidates.find((c) =>
              (clientAgenda.get(c.id) ?? []).every(
                ([cs, ce]) => end.toMillis() <= cs || ce <= start.toMillis(),
              ),
            );
            if (!client) {
              cursor += seed.slotIntervalMinutes;
              continue;
            }

            const isPast = end < now;
            const roll = random();
            let status: BookingStatus;
            if (isPast) status = roll < 0.8 ? 'COMPLETED' : roll < 0.92 ? 'CANCELLED' : 'NO_SHOW';
            else if (start < now) status = 'CONFIRMED';
            else status = roll < 0.65 ? 'CONFIRMED' : roll < 0.9 ? 'PENDING' : 'CANCELLED';

            await prisma.booking.create({
              data: {
                businessId: business.id,
                serviceId: service.id,
                professionalId: professional.id,
                clientId: client.id,
                startsAt: start.toJSDate(),
                endsAt: end.toJSDate(),
                status,
                priceCents: service.priceCents,
                cancelledAt: status === 'CANCELLED' ? start.minus({ days: 1 }).toJSDate() : null,
                cancellationReason: status === 'CANCELLED' ? 'Cancelada por el cliente' : null,
                cancelledById: status === 'CANCELLED' ? client.id : null,
                createdAt: start.minus({ days: 3 + Math.floor(random() * 10) }).toJSDate(),
              },
            });
            bookingCount++;
            if (status === 'PENDING' || status === 'CONFIRMED') {
              clientAgenda.set(client.id, [
                ...(clientAgenda.get(client.id) ?? []),
                [start.toMillis(), end.toMillis()],
              ]);
            }
            cursor += service.durationMinutes;
          }
        }
      }
    }
  }

  // A few in-app notifications so the notification center is not empty.
  const upcoming = await prisma.booking.findMany({
    where: {
      clientId: demoClient.id,
      startsAt: { gt: now.toJSDate() },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    include: { service: true, business: true },
    orderBy: { startsAt: 'asc' },
    take: 3,
  });
  for (const booking of upcoming) {
    const type: NotificationType =
      booking.status === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : 'BOOKING_CREATED';
    await prisma.notification.create({
      data: {
        userId: demoClient.id,
        type,
        title: type === 'BOOKING_CONFIRMED' ? 'Reserva confirmada' : 'Reserva registrada',
        body: `${booking.service.name} en ${booking.business.name}`,
        bookingId: booking.id,
      },
    });
  }

  console.warn(
    `Seed complete: ${BUSINESSES.length} businesses, ${clients.length} clients, ${bookingCount} bookings.`,
  );
  console.warn(`Demo password for every demo account: ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

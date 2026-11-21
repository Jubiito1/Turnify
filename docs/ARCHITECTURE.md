# Turnify — Arquitectura

Monorepo con una API REST (Express + Prisma + PostgreSQL), un frontend SPA (React + Vite) y un paquete compartido con validaciones y reglas puras. Este documento explica cómo encajan las piezas y por qué.

## Vista general

```
┌──────────────────────────┐      /api/* (mismo origen)       ┌───────────────────────────┐
│ apps/web                 │ ───────────────────────────────▶ │ apps/api                  │
│ React · Router · Query   │   cookie httpOnly turnify_session │ Express · Zod · Prisma    │
│ RHF + Zod · Tailwind     │ ◀─────────────────────────────── │ módulos por dominio       │
└────────────┬─────────────┘            JSON                  └─────────────┬─────────────┘
             │                                                              │ SQL parametrizado
             │            ┌────────────────────────────┐                    ▼
             └──────────▶ │ packages/shared            │ ◀──────── ┌────────────────────┐
                          │ Zod schemas · enums ·       │           │ PostgreSQL         │
                          │ transiciones · dinero       │           │ EXCLUDE gist · FK  │
                          └────────────────────────────┘           └────────────────────┘
```

- **Desarrollo:** Vite proxifica `/api` a `http://localhost:4000`.
- **Producción:** Vercel reescribe `/api/*` hacia el servicio de Render. El navegador solo habla con el dominio del frontend, por eso la cookie es de primera parte.

## Estructura del repositorio

```
turnify/
├── apps/
│   ├── api/
│   │   ├── prisma/              schema.prisma, migraciones, seed
│   │   ├── src/
│   │   │   ├── app.ts           composición de Express (sin listen)
│   │   │   ├── server.ts        arranque HTTP
│   │   │   ├── config/          variables de entorno validadas
│   │   │   ├── lib/             prisma, errores, logger, http helpers
│   │   │   ├── middleware/      auth, roles, rate limit, errores
│   │   │   └── modules/<dominio>/  *.routes.ts · *.service.ts · *.policy.ts
│   │   └── test/                helpers y tests de integración
│   └── web/
│       └── src/
│           ├── components/ui/   sistema de diseño
│           ├── features/<dominio>/  pantallas y hooks por dominio
│           ├── layouts/         layouts por rol
│           └── lib/             cliente HTTP, formato de fechas/dinero
├── packages/shared/src/         schemas Zod, enums, reglas puras
├── e2e/                         Playwright
└── docs/
```

## Backend

### Capas

| Capa               | Responsabilidad                                                     | Ejemplo                                       |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------------- |
| Rutas              | Declarar endpoint, middleware de auth/rol y validar entrada con Zod | `services.routes.ts`                          |
| Servicio           | Reglas de negocio y orquestación de transacciones                   | `booking.service.ts`                          |
| Política / dominio | Funciones puras testeables sin base de datos                        | `booking.policy.ts`, `availability.engine.ts` |
| Datos              | Prisma Client; consultas siempre filtradas por propietario          | dentro de cada servicio                       |

Se evitó una capa de repositorios separada: Prisma ya cumple ese rol y agregar otra capa sería complejidad artificial para este tamaño de problema. Las consultas viven en los servicios y siempre incluyen el filtro de alcance (`businessId`, `clientId` o `professionalId`).

### Módulos

| Módulo          | Endpoints                                                 | Rol                            |
| --------------- | --------------------------------------------------------- | ------------------------------ |
| `health`        | `GET /api/health`                                         | Público                        |
| `auth`          | registro, login, logout, me, perfil                       | Público / autenticado          |
| `catalog`       | negocios, servicios, profesionales, disponibilidad        | Público                        |
| `business`      | configuración del negocio                                 | Admin                          |
| `services`      | ABM de servicios                                          | Admin                          |
| `professionals` | ABM, servicios asignados, horarios, permisos              | Admin                          |
| `blocks`        | bloqueos                                                  | Admin / Profesional autorizado |
| `bookings`      | reservas de cliente y admin, estados, reprogramación, CSV | Cliente / Admin                |
| `pro`           | agenda e historial del profesional                        | Profesional                    |
| `clients`       | clientes del negocio                                      | Admin                          |
| `stats`         | métricas                                                  | Admin                          |
| `notifications` | notificaciones internas                                   | Autenticado                    |

### Manejo de errores

Los servicios lanzan `AppError(status, code, message, details?)`. Un middleware central traduce `AppError`, `ZodError` y errores conocidos de Prisma/PostgreSQL al formato `{ error: { code, message, details } }`. Los errores inesperados se registran y devuelven `500 INTERNAL_ERROR` sin filtrar detalles.

### Autenticación y autorización

1. Login verifica bcrypt y emite un JWT (`sub`, `role`, `businessId`) firmado con `JWT_SECRET`, guardado en la cookie `turnify_session` (`httpOnly`, `SameSite=Lax`, `Secure` en producción).
2. `authenticate` valida el token y carga el usuario; `requireRole(...)` verifica el rol.
3. El alcance de cada recurso se deriva **siempre** de la sesión (nunca de parámetros del cliente).
4. `express-rate-limit` limita login y registro por IP.

## Modelo de datos

```
User ─┬─< Booking (clientId)
      ├── Business (adminId, 1:1 admin)
      └── Professional (userId opcional, 1:1)

Business ─┬─< Service ─┬─< ProfessionalService >─┬─ Professional
          ├─< Professional ─────────────────────┘    ├─< WorkingHours
          └─< Booking                                 ├─< TimeBlock
                                                      └─< Booking
User ─< Notification
```

| Tabla          | Campos clave                                                                                       | Restricciones                                              |
| -------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `User`         | email (único, minúsculas), passwordHash, role                                                      | —                                                          |
| `Business`     | slug (único), timezone, cancellationMinHours, slotIntervalMinutes, bookingHorizonDays, autoConfirm | `CHECK` de rangos                                          |
| `Service`      | durationMinutes, priceCents, isActive                                                              | `CHECK duration > 0`, `price >= 0`                         |
| `Professional` | isActive, canManageBlocks, canCompleteBookings                                                     | —                                                          |
| `WorkingHours` | weekday, startMinute, endMinute                                                                    | `CHECK 0<=start<end<=1440`                                 |
| `TimeBlock`    | startsAt, endsAt                                                                                   | `CHECK startsAt < endsAt`                                  |
| `Booking`      | startsAt, endsAt, status, priceCents                                                               | `EXCLUDE` por profesional y por cliente en estados activos |

## Concurrencia (RN-006, RN-020, RN-028)

La validación previa (consultar disponibilidad y luego insertar) tiene una condición de carrera: dos solicitudes pueden ver el mismo hueco libre. Por eso la autoridad es la base de datos:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist ("professionalId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED'));
```

- El rango semiabierto `[)` permite turnos contiguos (10:00–10:30 y 10:30–11:00).
- La condición parcial hace que cancelados/completados no ocupen agenda (RN-012).
- PostgreSQL serializa la verificación del índice GiST: de N inserciones simultáneas solo una tiene éxito; el resto recibe `23P01`, que la API traduce a `409 SLOT_TAKEN`.

### Reglas entre tablas (RN-005, RN-029)

Una restricción de exclusión no puede comparar filas de tablas distintas (reservas contra bloqueos). Para esas reglas, la creación de reservas y de bloqueos abre una transacción y bloquea la fila del profesional con `SELECT … FOR UPDATE` (`apps/api/src/lib/locks.ts`). Así, una reserva y un bloqueo simultáneos sobre el mismo profesional se serializan: el segundo ve al primero y es rechazado.

## Tiempo y zonas horarias (RN-019)

- Instantes (`startsAt`, `endsAt`, bloqueos) en `timestamptz`.
- Horarios laborales: `weekday` + minutos locales, interpretados en `Business.timezone` con Luxon. Así "lunes 9:00–18:00" sigue siendo 9:00 local aunque cambie el horario de verano.
- La API recibe y devuelve ISO-8601; el frontend muestra fechas en la zona del negocio.

## Frontend

| Aspecto            | Decisión                                                                             |
| ------------------ | ------------------------------------------------------------------------------------ |
| Rutas              | React Router con layouts por rol y guardas (`RequireRole`).                          |
| Datos del servidor | TanStack Query (cache, invalidación tras mutaciones, estados de carga/error).        |
| Formularios        | React Hook Form + resolvers de Zod con los **mismos** esquemas de `@turnify/shared`. |
| Estilos            | Tailwind CSS 4 con tokens propios (`@theme`).                                        |
| Componentes        | Sistema de diseño propio en `components/ui`; diálogos accesibles con Radix.          |

## Testing

| Nivel       | Ubicación                                      | Base de datos                                                   |
| ----------- | ---------------------------------------------- | --------------------------------------------------------------- |
| Unitario    | `packages/shared`, `apps/api/src/**/*.test.ts` | —                                                               |
| Integración | `apps/api/test/**/*.int.test.ts`               | PostgreSQL efímero (`embedded-postgres`) con migraciones reales |
| Componentes | `apps/web/src/**/*.test.tsx`                   | — (API simulada con MSW)                                        |
| E2E         | `e2e/`                                         | PostgreSQL efímero + API + web reales                           |

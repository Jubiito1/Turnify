# Turnify — API REST

Base URL: `/api` (en producción, el frontend reescribe `/api/*` hacia el backend).

## Convenciones

| Aspecto    | Regla                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Formato    | JSON (`Content-Type: application/json`), cuerpo máximo 100 KB                                                   |
| Fechas     | ISO-8601 con zona (`2026-12-10T13:00:00.000Z`); fechas sin hora como `AAAA-MM-DD`                               |
| Dinero     | Enteros en centavos (`priceCents`)                                                                              |
| Sesión     | Cookie `httpOnly` `turnify_session` emitida por login/registro                                                  |
| Paginación | `?page=1&pageSize=20` → `{ items, total, page, pageSize }`                                                      |
| Errores    | `{ "error": { "code", "message", "details"? } }` — códigos en [`SPEC.md`](./SPEC.md#códigos-de-error-de-la-api) |

## Seguridad

- Todas las rutas protegidas validan sesión y rol en el servidor (RN-024); los recursos de otro usuario o negocio responden `404` (RN-021).
- En producción, las solicitudes que modifican estado con una cabecera `Origin` ajena reciben `403` (protección CSRF adicional a `SameSite=Lax`).
- Detalle completo en [`SECURITY.md`](./SECURITY.md).

## Salud

### `GET /api/health`

Público. Indica que el servicio está en línea.

```json
{
  "status": "ok",
  "service": "turnify-api",
  "startedAt": "2026-11-21T02:34:02.419Z",
  "uptimeSeconds": 12
}
```

## Autenticación

| Método  | Ruta                    | Acceso               | Descripción                                                                                                    |
| ------- | ----------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST`  | `/api/auth/register`    | Público (rate limit) | Registra un cliente y abre sesión. Body: `{ name, email, password, phone? }` → `201 { user }`                  |
| `POST`  | `/api/auth/login`       | Público (rate limit) | Body: `{ email, password }` → `200 { user }` + cookie `turnify_session`                                        |
| `POST`  | `/api/auth/logout`      | Público              | Elimina la cookie de sesión → `204`                                                                            |
| `GET`   | `/api/auth/session`     | Público              | Sesión actual o `null`, siempre `200` (la web lo usa para no generar 401 en visitantes) → `{ user: SessionUser | null }` |
| `GET`   | `/api/auth/me`          | Autenticado          | Usuario actual → `{ user: SessionUser }`                                                                       |
| `PATCH` | `/api/auth/me`          | Autenticado          | Actualiza perfil. Body: `{ name, phone? }`                                                                     |
| `POST`  | `/api/auth/me/password` | Autenticado          | Body: `{ currentPassword, newPassword }` → `204`                                                               |

`SessionUser`: `{ id, name, email, phone, role: "CLIENT" | "PROFESSIONAL" | "ADMIN", businessId, professionalId }`.

Errores: `409 EMAIL_TAKEN`, `401 INVALID_CREDENTIALS` (mismo mensaje para email inexistente y contraseña incorrecta), `400 INVALID_CURRENT_PASSWORD`, `429 TOO_MANY_REQUESTS` (más de `AUTH_RATE_LIMIT_MAX` intentos por IP en 15 minutos).

## Onboarding de negocio

### `POST /api/auth/register-business`

Público (rate limit). Crea un administrador y su negocio en una transacción y abre sesión.

Body: `{ name, email, password, businessName, category, timezone, address?, phone? }` → `201 { user, business }`. El `slug` se genera a partir del nombre (sin acentos, único).

## Catálogo público

| Método | Ruta                                           | Descripción                                                                                                                |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/businesses?q=&category=&page=&pageSize=` | Negocios activos. `q` busca en nombre, descripción y dirección (sin distinguir mayúsculas). → `Paginated<BusinessSummary>` |
| `GET`  | `/api/businesses/:slug`                        | Página del negocio → `{ business, services, professionals }` (solo servicios y profesionales activos)                      |

## Administración del negocio

Todas las rutas `/api/admin/*` requieren sesión con rol `ADMIN` (`401` sin sesión, `403` con otro rol). El negocio se deriva de la sesión, nunca de un parámetro.

| Método | Ruta                  | Descripción                                                                                                                                                                                                      |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/business` | Configuración del negocio → `{ business: BusinessDetail }`                                                                                                                                                       |
| `PUT`  | `/api/admin/business` | Actualiza datos y políticas. Body: `{ name, description?, category, timezone, address?, phone?, cancellationMinHours (0–168), slotIntervalMinutes (5,10,15,20,30,60), bookingHorizonDays (1–365), autoConfirm }` |

### Servicios (`/api/admin/services`)

| Método   | Ruta                      | Descripción                                                                                                                    |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/admin/services`     | Todos los servicios del negocio (activos primero) con `professionalCount`                                                      |
| `POST`   | `/api/admin/services`     | Body: `{ name, description?, durationMinutes (5–480, múltiplo de 5), priceCents (entero ≥ 0), isActive? }` → `201 { service }` |
| `PATCH`  | `/api/admin/services/:id` | Actualización parcial (los campos omitidos no cambian). `isActive: false` desactiva (RN-017)                                   |
| `DELETE` | `/api/admin/services/:id` | Solo si no tiene reservas; si tiene → `409 SERVICE_HAS_BOOKINGS`                                                               |

Un servicio de otro negocio responde `404` (RN-011, RN-021).

### Profesionales (`/api/admin/professionals`)

| Método  | Ruta                                         | Descripción                                                                                                                                                                                |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/admin/professionals`                   | Todos los profesionales (activos primero) → `{ items: ProfessionalDTO[] }`                                                                                                                 |
| `POST`  | `/api/admin/professionals`                   | Body: `{ displayName, bio?, isActive?, canManageBlocks?, canCompleteBookings?, account?: { email, password } }`. Con `account` se crea un usuario `PROFESSIONAL` para el panel profesional |
| `GET`   | `/api/admin/professionals/:id`               | Detalle                                                                                                                                                                                    |
| `PATCH` | `/api/admin/professionals/:id`               | Actualización parcial; `isActive: false` desactiva sin borrar historial (RN-023)                                                                                                           |
| `PUT`   | `/api/admin/professionals/:id/services`      | Reemplaza servicios asignados. Body: `{ serviceIds: uuid[] }`. Servicios de otro negocio → `422 INVALID_SERVICE_ASSIGNMENT`                                                                |
| `PUT`   | `/api/admin/professionals/:id/working-hours` | Reemplaza el horario semanal. Body: `{ hours: [{ weekday (0=domingo…6), startMinute, endMinute }] }` en minutos locales del negocio; franjas superpuestas → `400` (RN-030)                 |

`ProfessionalDTO`: `{ id, displayName, bio, isActive, canManageBlocks, canCompleteBookings, account: { email } | null, serviceIds, workingHours }`.

## Disponibilidad

### `GET /api/businesses/:slug/availability?serviceId=&date=AAAA-MM-DD&professionalId=`

Público. Horarios libres reales para una fecha local del negocio (RN-008). Considera franjas laborales (en la zona horaria del negocio), duración del servicio, intervalo de turnos, reservas activas, bloqueos, horizonte de reserva y descarta horarios pasados.

```json
{
  "date": "2026-12-07",
  "timezone": "America/Argentina/Buenos_Aires",
  "serviceId": "…",
  "durationMinutes": 45,
  "slots": [
    {
      "startsAt": "2026-12-07T12:00:00.000Z",
      "endsAt": "2026-12-07T12:45:00.000Z",
      "professionalIds": ["…", "…"]
    }
  ]
}
```

Sin `professionalId`, cada horario lista los profesionales elegibles libres. Errores: `404` servicio inexistente o de otro negocio, `422 SERVICE_INACTIVE`, `422 PROFESSIONAL_NOT_ELIGIBLE`.

### `GET /api/businesses/:slug/availability/summary?serviceId=&from=AAAA-MM-DD&days=14&professionalId=`

Cantidad de horarios libres por día (1 a 31 días) para el selector de fechas → `{ timezone, serviceId, days: [{ date, slotCount }] }`.

## Bloqueos de disponibilidad

| Método   | Ruta                                          | Acceso                            | Descripción                                                             |
| -------- | --------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `GET`    | `/api/admin/blocks?from=&to=&professionalId=` | Admin                             | Bloqueos vigentes del negocio (por defecto, desde ahora)                |
| `POST`   | `/api/admin/blocks`                           | Admin                             | Body: `{ professionalId, startsAt, endsAt, reason? }` → `201 { block }` |
| `DELETE` | `/api/admin/blocks/:id`                       | Admin                             | → `204`                                                                 |
| `GET`    | `/api/pro/blocks`                             | Profesional                       | Bloqueos propios                                                        |
| `POST`   | `/api/pro/blocks`                             | Profesional con `canManageBlocks` | El `professionalId` se fuerza al propio perfil                          |
| `DELETE` | `/api/pro/blocks/:id`                         | Profesional con `canManageBlocks` | Solo bloqueos propios                                                   |

Errores: `409 BLOCK_CONFLICTS_WITH_BOOKINGS` con `details.conflictingBookings` (RN-029), `422 BLOCK_IN_PAST`, `403 PERMISSION_DENIED` (RN-033), `404` para profesionales o bloqueos fuera del ámbito.

## Reservas

### Crear (cliente) — `POST /api/bookings`

Rol `CLIENT`. Body: `{ serviceId, professionalId, startsAt, notes? }`. El servidor calcula `endsAt` con la duración del servicio (RN-007) y guarda una copia del precio (RN-018). Estado inicial `PENDING`, o `CONFIRMED` si el negocio tiene `autoConfirm`.

### Crear (admin) — `POST /api/admin/bookings`

Body: `{ serviceId, professionalId, startsAt, notes?, client: { name, email } }`. Si el email no existe se crea un cliente invitado (sin contraseña; puede reclamar la cuenta registrándose). Estado `CONFIRMED`.

### Detalle (cliente) — `GET /api/bookings/:id`

Solo reservas propias; las ajenas responden `404` (RN-009, RN-021).

`BookingDTO`: `{ id, status, startsAt, endsAt, priceCents, notes, cancellationReason, cancelledAt, createdAt, service, professional, business, client }`.

### Validaciones al crear

| Código                      | HTTP | Regla                                                                      |
| --------------------------- | ---- | -------------------------------------------------------------------------- |
| `BOOKING_IN_PAST`           | 422  | RN-001                                                                     |
| `SERVICE_INACTIVE`          | 422  | RN-002, RN-017                                                             |
| `PROFESSIONAL_NOT_ELIGIBLE` | 422  | RN-003, RN-025                                                             |
| `BEYOND_BOOKING_HORIZON`    | 422  | RN-027                                                                     |
| `SLOT_UNAVAILABLE`          | 409  | Fuera de horario, desalineado o bloqueado (RN-004, RN-005, RN-034)         |
| `SLOT_TAKEN`                | 409  | Superposición con otra reserva activa del profesional (RN-006, RN-020)     |
| `CLIENT_OVERLAP`            | 409  | El cliente ya tiene una reserva activa superpuesta (RN-028)                |
| `INVALID_CLIENT`            | 422  | El email indicado por el admin pertenece a una cuenta que no es de cliente |

### Ciclo de vida

| Método  | Ruta                                 | Acceso                                          | Descripción                                                                                                          |
| ------- | ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST`  | `/api/bookings/:id/cancel`           | Cliente (propia)                                | Body: `{ reason? }`. Requiere `cancellationMinHours` de anticipación (RN-013)                                        |
| `POST`  | `/api/bookings/:id/reschedule`       | Cliente (propia)                                | Body: `{ startsAt }`. Revalida disponibilidad (RN-016); vuelve a `PENDING` si el negocio no confirma automáticamente |
| `PATCH` | `/api/admin/bookings/:id/status`     | Admin                                           | Body: `{ status, reason? }`. Confirmar, cancelar (sin restricción de anticipación), completar o marcar ausente       |
| `POST`  | `/api/admin/bookings/:id/reschedule` | Admin                                           | Body: `{ startsAt, professionalId? }`. Permite cambiar a otro profesional elegible                                   |
| `PATCH` | `/api/pro/bookings/:id/status`       | Profesional (propia, con `canCompleteBookings`) | Solo `COMPLETED` o `NO_SHOW`                                                                                         |

Transiciones válidas: `PENDING → CONFIRMED | CANCELLED`, `CONFIRMED → COMPLETED | CANCELLED | NO_SHOW` (RN-015). Errores: `422 INVALID_TRANSITION`, `422 BOOKING_NOT_STARTED` (RN-026), `422 CANCELLATION_WINDOW_PASSED`, `422 BOOKING_NOT_ACTIVE`, `409 BOOKING_CHANGED` (otra persona modificó la reserva al mismo tiempo), `403 PERMISSION_DENIED`, más los errores de disponibilidad al reprogramar.

### Consultas

| Método | Ruta                                                                                  | Acceso      | Descripción                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/bookings?scope=upcoming\|past&page=&pageSize=`                                  | Cliente     | `upcoming`: activas y futuras (ascendente). `past`: historial (pasadas o finalizadas, descendente)                                               |
| `GET`  | `/api/admin/bookings?from=&to=&status=&professionalId=&serviceId=&q=&page=&pageSize=` | Admin       | Listado paginado. `from`/`to` son fechas locales del negocio; `status` acepta lista separada por comas; `q` busca por nombre o email del cliente |
| `GET`  | `/api/admin/bookings/calendar?from=&to=&professionalId=`                              | Admin       | Todas las reservas del rango en orden cronológico (vistas semanal y mensual)                                                                     |
| `GET`  | `/api/admin/bookings/export.csv?…`                                                    | Admin       | Mismos filtros que el listado; CSV UTF-8 con horas locales y montos exactos. Celdas que empiezan con `= + - @` se neutralizan (inyección CSV)    |
| `GET`  | `/api/admin/bookings/:id`                                                             | Admin       | Detalle                                                                                                                                          |
| `GET`  | `/api/admin/clients?q=&page=&pageSize=`                                               | Admin       | Clientes con al menos una reserva en el negocio → `ClientSummaryDTO` (`totalBookings`, `completedBookings`, `lastBookingAt`)                     |
| `GET`  | `/api/pro/me`                                                                         | Profesional | Perfil propio, negocio y horario                                                                                                                 |
| `GET`  | `/api/pro/bookings?from=&to=&status=&page=&pageSize=`                                 | Profesional | Agenda e historial propios (RN-010)                                                                                                              |

## Estadísticas

### `GET /api/admin/stats?from=AAAA-MM-DD&to=AAAA-MM-DD`

Admin. Métricas calculadas sobre reservas persistidas en el rango local (por defecto, últimos 30 días; máximo 366) (RN-022).

| Campo                                                       | Significado                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `totals.bookings / active / completed / cancelled / noShow` | Conteos por estado                                                                                |
| `totals.revenueCents`                                       | Suma exacta (centavos) de reservas `COMPLETED`                                                    |
| `totals.expectedRevenueCents`                               | Suma de reservas activas (`PENDING`/`CONFIRMED`)                                                  |
| `totals.uniqueClients`                                      | Clientes distintos con reservas no canceladas                                                     |
| `totals.cancellationRate`                                   | Canceladas / total                                                                                |
| `totals.occupancyRate`                                      | Minutos reservados (no cancelados) / minutos laborales ofrecidos por profesionales activos        |
| `byService[]`, `byProfessional[]`                           | Reservas, completadas e ingresos; los profesionales incluyen `bookedMinutes` y `availableMinutes` |
| `byDay[]`                                                   | Reservas no canceladas e ingresos por fecha local                                                 |

Rango inválido → `422 INVALID_RANGE`.

## Notificaciones

| Método | Ruta                                        | Descripción                                       |
| ------ | ------------------------------------------- | ------------------------------------------------- |
| `GET`  | `/api/notifications?unreadOnly=true\|false` | Últimas 30 notificaciones propias y `unreadCount` |
| `POST` | `/api/notifications/:id/read`               | Marca una como leída (solo propias)               |
| `POST` | `/api/notifications/read-all`               | Marca todas como leídas                           |

Se generan automáticamente ante eventos de reservas: el cliente recibe avisos de cambios hechos por el negocio (y un comprobante al reservar); el administrador y el profesional asignado reciben avisos de cambios hechos por otros.

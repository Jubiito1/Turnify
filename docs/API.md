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

| Método  | Ruta                    | Acceso               | Descripción                                                                                   |
| ------- | ----------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `POST`  | `/api/auth/register`    | Público (rate limit) | Registra un cliente y abre sesión. Body: `{ name, email, password, phone? }` → `201 { user }` |
| `POST`  | `/api/auth/login`       | Público (rate limit) | Body: `{ email, password }` → `200 { user }` + cookie `turnify_session`                       |
| `POST`  | `/api/auth/logout`      | Público              | Elimina la cookie de sesión → `204`                                                           |
| `GET`   | `/api/auth/me`          | Autenticado          | Usuario actual → `{ user: SessionUser }`                                                      |
| `PATCH` | `/api/auth/me`          | Autenticado          | Actualiza perfil. Body: `{ name, phone? }`                                                    |
| `POST`  | `/api/auth/me/password` | Autenticado          | Body: `{ currentPassword, newPassword }` → `204`                                              |

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

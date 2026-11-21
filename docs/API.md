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

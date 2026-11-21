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

# Turnify — Despliegue

Producción usa tres servicios gratuitos. El navegador solo habla con Vercel; Vercel reescribe `/api/*` hacia Render, así la cookie de sesión es de primera parte.

```
Navegador ──► Vercel (web estática)
               └─ /api/* ──► Render (API Express) ──► Neon (PostgreSQL)
```

| Pieza         | Servicio                                       | Configuración en el repo        |
| ------------- | ---------------------------------------------- | ------------------------------- |
| Base de datos | Neon (PostgreSQL 16+, `btree_gist` disponible) | —                               |
| API           | Render Web Service (Node 22, plan Free)        | [`render.yaml`](../render.yaml) |
| Web           | Vercel (sitio estático Vite)                   | [`vercel.json`](../vercel.json) |

## Variables de entorno

| Variable                                                                                          | Dónde  | Valor                                                                           |
| ------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                    | Render | Cadena de conexión **directa** de Neon (no la _pooled_), con `?sslmode=require` |
| `JWT_SECRET`                                                                                      | Render | Generada automáticamente por el Blueprint (≥ 32 caracteres)                     |
| `CORS_ORIGINS`                                                                                    | Render | URL pública de Vercel, p. ej. `https://turnify-generacion-t.vercel.app`         |
| `NODE_ENV`, `TRUST_PROXY`, `NODE_VERSION`, `AUTH_RATE_LIMIT_MAX`, `SESSION_TTL_DAYS`, `LOG_LEVEL` | Render | Definidas en `render.yaml`                                                      |

Ningún valor real se guarda en el repositorio.

## Paso a paso

### 1. Neon

1. Crear un proyecto (región cercana a Render Oregon: `us-west-2`).
2. Copiar la _connection string_ directa (desactivar "Connection pooling") con `sslmode=require`.

### 2. Render (API)

1. **New → Blueprint**, elegir el repositorio de GitHub. Render lee `render.yaml` y crea `turnify-api`.
2. Completar `DATABASE_URL` (paso 1) y `CORS_ORIGINS` (URL de Vercel; se puede completar después).
3. El arranque ejecuta `prisma migrate deploy` (idempotente) y luego el servidor. Verificar `https://<servicio>.onrender.com/api/health` → `{"status":"ok","database":"ok"}`.
4. Cargar los datos demo **una sola vez**, desde una máquina local, apuntando a Neon:

   ```bash
   DATABASE_URL="<cadena de Neon>" SEED_RESET=true npm run db:seed
   ```

   El seed se niega a borrar una base con datos si no se pasa `SEED_RESET=true`.

### 3. Vercel (web)

1. **Add New → Project**, importar el repositorio. _Root Directory_: la raíz del repo (Vercel lee `vercel.json`: instala con `npm ci --ignore-scripts`, compila `@turnify/web` y publica `apps/web/dist`).
2. Si la URL de Render no es `turnify-api.onrender.com`, actualizar el `destination` de la reescritura `/api/:path*` en `vercel.json`.
3. Copiar la URL de Vercel en `CORS_ORIGINS` de Render.

## Verificación

| Prueba                                                        | Esperado                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET https://<vercel>/api/health`                             | `200` con `"database":"ok"` (pasa por la reescritura)        |
| Abrir la web y entrar con `cliente@turnify.demo` / `Demo1234` | Llega a "Mis reservas"                                       |
| Reservar un turno desde "Explorar"                            | Pantalla de confirmación y reserva visible en "Mis reservas" |
| Entrar con `admin@turnify.demo`                               | Dashboard con métricas del seed                              |

El build de producción se verificó localmente (T26): API compilada con `tsup` y `NODE_ENV=production`, web servida por `vite preview` con proxy `/api` — health con base OK, fallback SPA `200`, cookie `HttpOnly; Secure; SameSite=Lax` y origen ajeno rechazado con `403`.

## Limitaciones del plan gratuito

| Servicio    | Limitación                                                                              | Mitigación                                                                  |
| ----------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Render Free | La API se duerme tras ~15 min sin tráfico; la primera solicitud puede tardar 30–60 s    | La web reintenta con _backoff_ y muestra "Estamos despertando el servidor…" |
| Render Free | 750 h/mes, sin disco persistente                                                        | La API es _stateless_; todo vive en Neon                                    |
| Neon Free   | El cómputo se suspende sin actividad (arranque en ~1 s) y tiene cuota de almacenamiento | Datos demo livianos                                                         |
| Rate limit  | En memoria por instancia                                                                | Suficiente con una instancia                                                |

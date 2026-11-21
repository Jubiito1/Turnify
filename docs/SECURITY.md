# Turnify — Revisión de seguridad

Revisión realizada en la tarea T25 (21/11/2026). Cada control indica dónde está implementado y qué test lo verifica.

## Checklist

| Control                            | Implementación                                                                                                                                           | Evidencia                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Contraseñas con hash seguro        | bcrypt (10 rondas en producción); nunca se devuelve el hash                                                                                              | `auth.service.ts` · `auth.int.test.ts` ("stores only a bcrypt hash")                                                    |
| Sesión segura                      | JWT HS256 firmado con `JWT_SECRET` (≥ 32 caracteres, validado al arrancar) en cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción                  | `session.ts`, `config/env.ts` · test de cookie en `auth.int.test.ts`                                                    |
| Token manipulado                   | Firma y algoritmo verificados (`algorithms: ['HS256']`)                                                                                                  | `auth.int.test.ts` ("rejects a tampered session token")                                                                 |
| Fuerza bruta                       | `express-rate-limit` en login y registro (`AUTH_RATE_LIMIT_MAX` por IP cada 15 min); `trust proxy` configurable para obtener la IP real detrás del proxy | `rate-limit.ts` · RN-032 en `auth.int.test.ts`                                                                          |
| Enumeración de usuarios            | Mismo error para email inexistente y contraseña incorrecta; comparación bcrypt contra hash ficticio para igualar tiempos                                 | `auth.service.ts` · `auth.int.test.ts`                                                                                  |
| Autorización por rol en el backend | `authenticate` + `requireRole` por router; los roles y permisos se recargan desde la base en cada request                                                | `routes.ts`, `middleware/auth.ts` · RN-024 en varios tests                                                              |
| Autorización por recurso (IDOR)    | Toda consulta por id incluye el filtro de propietario derivado de la sesión; recursos ajenos responden `404`                                             | servicios de cada módulo · `services`, `professionals`, `blocks`, `booking-lifecycle`, `booking-queries` `.int.test.ts` |
| Aislamiento entre negocios         | `businessId` tomado siempre de la sesión del administrador                                                                                               | RN-011/RN-025 en todos los tests administrativos                                                                        |
| CSRF                               | Cookie `SameSite=Lax` + API solo JSON + _origin guard_ en producción para métodos que modifican estado                                                   | `origin-guard.ts` · `app.int.test.ts`                                                                                   |
| CORS                               | Lista blanca `CORS_ORIGINS` con `credentials`; orígenes desconocidos no reciben cabeceras CORS                                                           | `app.ts` · `app.int.test.ts`                                                                                            |
| Cabeceras de seguridad             | Helmet (nosniff, HSTS, frameguard, etc.), `x-powered-by` deshabilitado                                                                                   | `app.ts` · `app.int.test.ts`                                                                                            |
| Validación de entrada              | Zod en cada endpoint (body, query, params); ids no UUID → `404`; cuerpo máximo 100 KB                                                                    | `lib/validate.ts`, `@turnify/shared`                                                                                    |
| Inyección SQL                      | Solo Prisma (consultas parametrizadas); el único SQL crudo usa _tagged templates_ parametrizadas                                                         | `lib/locks.ts`, `health.routes.ts`                                                                                      |
| Inyección CSV                      | Celdas que empiezan con `= + - @` se neutralizan en la exportación                                                                                       | `lib/csv.ts` · `csv.test.ts`                                                                                            |
| XSS                                | React escapa todo el contenido; no se usa `dangerouslySetInnerHTML`                                                                                      | código del frontend                                                                                                     |
| Redirecciones abiertas             | `next` del login solo acepta rutas relativas del mismo sitio                                                                                             | `LoginPage.tsx` · `auth.test.tsx`                                                                                       |
| Errores                            | Respuestas `500` sin detalles internos; el detalle va al log (con cookies redactadas)                                                                    | `error-handler.ts`, `logger.ts`                                                                                         |
| Secretos                           | `.env` ignorado por git; `.env.example` sin valores reales; variables de producción configuradas en los paneles de los proveedores                       | `.gitignore` · escaneo de historial (abajo)                                                                             |

## Escaneo de secretos

Se buscaron en **todo el historial** (`git grep` sobre `git rev-list --all`) cadenas de conexión con credenciales, tokens de GitHub, claves AWS, claves privadas y valores de `JWT_SECRET`:

- Resultado: **0 coincidencias**. El único archivo de entorno versionado es `.env.example`.
- Las credenciales de las cuentas demo (`Demo1234`) son públicas a propósito y solo sirven para los datos de demostración.
- Los secretos de los tests (`vitest.config.ts`, `e2e-stack.ts`) son valores ficticios usados solo contra bases efímeras locales.

## Dependencias (`npm audit`)

| Alcance    | Hallazgo                                                                                                                                           | Evaluación                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Producción | 4 _high_ en `prisma` → `@prisma/config` → `deepmerge-ts` (recursión al fusionar objetos recursivos) y `effect` (ReDoS en `Schema.TemplateLiteral`) | Afectan al **CLI** de Prisma al cargar su configuración, que es código propio y estático; no son alcanzables desde una request HTTP. La corrección requiere migrar a Prisma 7 (cambio mayor), planificado fuera del alcance de la entrega. **Riesgo aceptado.** |
| Desarrollo | `vitest` 3 / `tinypool` (crítico), `@vitest/mocker`                                                                                                | Herramientas de test que solo ejecutan código propio en local/CI; no se despliegan. Se corrige migrando a Vitest 4 (mayor). **Riesgo aceptado.**                                                                                                                |
| Desarrollo | `happy-dom` ≤ 21.0.3                                                                                                                               | **Corregido**: actualizado a 21.0.4.                                                                                                                                                                                                                            |

## Limitaciones conocidas

- No hay recuperación de contraseña por email (requiere proveedor de correo; fuera de alcance).
- El rate limit es en memoria por instancia; con varias réplicas se usaría un store compartido (Redis).
- Los JWT no se revocan individualmente antes de expirar; el logout borra la cookie y los cambios de rol se aplican igual porque el rol se recarga desde la base en cada request.

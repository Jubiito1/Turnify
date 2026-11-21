# Turnify — Plan de desarrollo

Turnify es una plataforma SaaS de gestión de turnos para pequeños negocios: los clientes reservan online con disponibilidad real y los negocios administran servicios, profesionales, horarios, bloqueos, reservas y métricas.

Este plan define qué se construye, cómo y en qué orden. El estado vivo de cada tarea está en [`TASKS.md`](./TASKS.md); las reglas en [`SPEC.md`](./SPEC.md).

## 1. Objetivos

1. Entregar una aplicación full stack **funcional y pública**, con reglas de negocio reales verificadas por tests.
2. Garantizar la integridad de la agenda: sin superposiciones, incluso ante solicitudes concurrentes.
3. Aislar de forma segura los datos de cada negocio (multi-tenant).
4. Ofrecer una experiencia de uso cuidada, responsive y accesible para tres roles.
5. Dejar un repositorio profesional: historial incremental, documentación completa y sin secretos.

## 2. Alcance

| Incluido | Fuera de alcance |
|----------|------------------|
| Registro, login, logout, perfiles | Pagos online reales |
| Onboarding de negocio | Envío de emails/SMS (requiere proveedor pago) |
| Servicios, profesionales, horarios, bloqueos | Aplicaciones móviles nativas |
| Motor de disponibilidad con zona horaria | Integración con calendarios externos |
| Reservas, cancelación, reprogramación, estados | Facturación electrónica |
| Panel admin, panel profesional, panel cliente | |
| Calendario semanal y mensual | |
| Dashboard con métricas reales y por servicio/profesional | |
| Búsqueda y filtros, exportación CSV | |
| Notificaciones dentro de la aplicación | |
| Política de cancelación configurable | |

## 3. Requisitos funcionales

| ID | Requisito | Rol |
|----|-----------|-----|
| RF-01 | Registrarse como cliente; registrar un negocio (crea administrador + negocio) | Público |
| RF-02 | Iniciar y cerrar sesión; consultar la sesión actual | Todos |
| RF-03 | Explorar negocios con búsqueda por nombre y filtro por rubro | Público |
| RF-04 | Ver servicios y profesionales de un negocio | Público |
| RF-05 | Consultar disponibilidad por servicio, profesional y fecha | Público |
| RF-06 | Reservar, listar, cancelar y reprogramar reservas propias | Cliente |
| RF-07 | Editar perfil y contraseña | Todos |
| RF-08 | Configurar datos del negocio y política de cancelación | Admin |
| RF-09 | ABM de servicios (duración, precio, activo) | Admin |
| RF-10 | ABM de profesionales, asignación de servicios, horarios y permisos | Admin |
| RF-11 | Gestionar bloqueos de disponibilidad | Admin / Profesional autorizado |
| RF-12 | Calendario general semanal y mensual | Admin |
| RF-13 | Crear, confirmar, cancelar, completar y reprogramar reservas | Admin |
| RF-14 | Listado de reservas con filtros (fecha, estado, profesional, servicio, texto) y exportación CSV | Admin |
| RF-15 | Listado de clientes con búsqueda | Admin |
| RF-16 | Dashboard de métricas: reservas, ingresos, ocupación, ranking por servicio y profesional | Admin |
| RF-17 | Agenda propia, historial y marcar turnos completados | Profesional |
| RF-18 | Notificaciones dentro de la aplicación ante eventos de reservas | Todos |

## 4. Requisitos no funcionales

| ID | Requisito |
|----|-----------|
| RNF-01 | Seguridad: bcrypt, sesión en cookie `httpOnly`, autorización por rol y recurso, CORS restringido, rate limiting, Helmet, sin secretos en el repositorio. |
| RNF-02 | Integridad: restricciones de base de datos (FK, únicos, `CHECK`, exclusión) como última línea de defensa. |
| RNF-03 | Rendimiento: índices en columnas de filtrado frecuente; paginación en listados. |
| RNF-04 | Usabilidad: diseño responsive (móvil, tablet, escritorio), estados de carga, vacíos y error. |
| RNF-05 | Accesibilidad: labels, foco visible, navegación por teclado, contraste AA. |
| RNF-06 | Mantenibilidad: TypeScript estricto, módulos por dominio, validación compartida con Zod. |
| RNF-07 | Testabilidad: tests unitarios, de integración contra PostgreSQL real y E2E. |
| RNF-08 | Disponibilidad: despliegue público gratuito; se documentan limitaciones (cold start). |

## 5. Arquitectura propuesta

Monorepo con npm workspaces. Detalle en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

```
apps/web  (React + Vite)  ──/api──▶  apps/api (Express)  ──Prisma──▶  PostgreSQL
            └──────────── packages/shared (Zod, tipos, reglas puras) ────────────┘
```

| Capa | Tecnología | Motivo |
|------|------------|--------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, React Hook Form, Zod | Stack moderno, tipado y productivo. |
| Backend | Node.js, Express 5, TypeScript, Zod, Prisma | API REST simple, validación compartida y ORM con migraciones. |
| Base de datos | PostgreSQL (Neon en producción) | Restricciones de exclusión para concurrencia; `timestamptz`. |
| Tests | Vitest, Supertest, React Testing Library, Playwright, embedded-postgres | PostgreSQL real y efímero sin Docker. |
| Infra | GitHub, Vercel (web), Render (API), Neon (DB) | Planes gratuitos suficientes. |

### Decisiones clave

1. **Concurrencia:** restricción `EXCLUDE USING gist` sobre `(professionalId, tstzrange(startsAt, endsAt))` filtrada a estados activos, más otra por cliente. La base rechaza superposiciones de forma atómica (`23P01`) y la API lo traduce a `409`.
2. **Sesión:** JWT firmado en cookie `httpOnly`, `SameSite=Lax`. En producción el frontend reescribe `/api/*` hacia el backend, así la cookie es de primera parte y no depende de cookies de terceros.
3. **Tiempo:** instantes en UTC (`timestamptz`); horarios laborales en minutos locales + zona IANA del negocio; conversión con Luxon.
4. **Dinero:** enteros en centavos y copia del precio en la reserva.
5. **Multi-tenancy:** `businessId` derivado de la sesión del administrador; cada consulta filtra por propietario.

## 6. Fases de implementación

| Fase | Contenido | Tareas |
|------|-----------|--------|
| 1. Inicialización | Documentación base, monorepo, herramientas | T01–T04 |
| 2. Backend y DB | Esquema, migraciones, auth, catálogo, servicios, profesionales, disponibilidad, bloqueos, reservas, estados, estadísticas, notificaciones | T05–T15 |
| 3. Frontend | Sistema de diseño, auth, catálogo, flujo de reserva, paneles cliente/profesional/admin, calendario, métricas | T16–T23 |
| 4. Integración y QA | E2E, revisión de seguridad, documentación de API | T24–T25 |
| 5. Producción | Configuración de despliegue, Neon, Render, Vercel, smoke tests | T26–T27 |
| 6. Auditoría final | Informe de pruebas, README, verificación contra la consigna | T28 |

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Reservas duplicadas por concurrencia | Alto | Restricción de exclusión + test con solicitudes simultáneas. |
| Errores de zona horaria / horario de verano | Medio | Luxon con zona IANA; tests con zonas distintas y cambio de horario. |
| Fuga de datos entre negocios (IDOR) | Alto | `businessId` desde la sesión; tests de aislamiento. |
| Cookies de terceros bloqueadas por el navegador | Medio | Reescritura `/api` en el frontend (mismo origen). |
| Cold start del plan gratuito de Render | Medio | Pantalla de "despertando servidor" con reintentos; documentado. |
| Sin Docker en el entorno de desarrollo | Medio | `embedded-postgres` para tests de integración y E2E. |
| Credenciales cloud no disponibles | Medio | Configuración declarativa (`render.yaml`, `vercel.json`) e instrucciones exactas. |

## 8. Estrategia de testing

| Nivel | Herramienta | Qué valida |
|-------|-------------|------------|
| Unitario | Vitest | Motor de disponibilidad, transiciones de estado, políticas de cancelación, esquemas Zod, dinero. |
| Integración | Vitest + Supertest + PostgreSQL efímero | Auth, autorización, ABM, reservas, solapamientos, aislamiento, concurrencia, estadísticas. |
| Componentes | Vitest + React Testing Library | Formularios, validaciones, selector de horarios, estados de carga/error. |
| E2E | Playwright | Registro/login, reserva completa, cancelación, reprogramación, administración, agenda. |

Los tests de integración nunca usan mocks de la base de datos ni se ejecutan contra producción. Los resultados reales se registran en [`TEST_REPORT.md`](./TEST_REPORT.md).

## 9. Estrategia de despliegue

1. **Neon:** base PostgreSQL; migraciones con `prisma migrate deploy`; seed de datos demo.
2. **Render:** servicio web Node definido en `render.yaml` (build, start, health check `/api/health`).
3. **Vercel:** sitio estático de Vite con reescritura `/api/*` → Render y fallback SPA.
4. **Verificación:** health check, login demo y una reserva real desde la URL pública.

Detalle en [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## 10. Criterios de aceptación

- [ ] Todas las reglas de `SPEC.md` implementadas y con tests asociados.
- [ ] Suite completa (unitaria, integración, componentes, E2E) en verde.
- [ ] Todas las tareas de `TASKS.md` completadas, con un commit por tarea.
- [ ] Frontend, backend y base de datos desplegados y verificados desde la URL pública.
- [ ] README, AGENTS.md, informe de pruebas y documentación de API completos.
- [ ] Ningún secreto en el repositorio.

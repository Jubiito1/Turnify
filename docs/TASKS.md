# Turnify — Tareas

Estado vivo del desarrollo. Cada tarea se cierra con **un commit** (Conventional Commits) que incluye el cambio de estado de la tarea.

## Convenciones

- `- [ ]` pendiente · `- [x]` completada y **verificada** (tests/chequeos ejecutados).
- **Commit:** como un commit no puede contener su propio hash, el hash de la tarea N se registra al cerrar la tarea N+1. El mensaje de commit siempre referencia el ID (`T07`).
- **RN:** reglas de [`SPEC.md`](./SPEC.md) relacionadas.

## Progreso

| Fase                | Tareas  | Completadas |
| ------------------- | ------- | ----------- |
| 1. Inicialización   | T01–T04 | 4/4         |
| 2. Backend y DB     | T05–T15 | 11/11       |
| 3. Frontend         | T16–T23 | 8/8         |
| 4. Integración y QA | T24–T25 | 1/2         |
| 5. Producción       | T26–T27 | 0/2         |
| 6. Auditoría        | T28     | 0/1         |

---

## Fase 1 — Inicialización

- [x] **T01 — Documentación base del proyecto**
  - Descripción: `AGENTS.md`, `docs/SPEC.md`, `docs/PLAN.md`, `docs/TASKS.md`, `docs/ARCHITECTURE.md`.
  - Dependencias: —
  - RN: todas (definición).
  - Criterios: reglas numeradas con criterios de aceptación; plan con fases, riesgos y estrategias; tareas con dependencias.
  - Commit: `bbb9cec`

- [x] **T02 — Workspace monorepo y paquete compartido**
  - Descripción: npm workspaces, TypeScript estricto, ESLint, Prettier, `.gitignore`, `.env.example`, paquete `@turnify/shared` con enums, transiciones de estado, dinero y esquemas Zod base.
  - Dependencias: T01
  - RN: RN-015, RN-018, RN-030, RN-031
  - Criterios: `npm run typecheck`, `npm run lint` y tests unitarios de `shared` en verde.
  - Commit: `0565c5d`

- [x] **T03 — Esqueleto de la API**
  - Descripción: Express 5, configuración validada por Zod, Helmet, CORS, manejo centralizado de errores, logger, `GET /api/health`.
  - Dependencias: T02
  - RN: RN-024
  - Criterios: test de integración del health check y del formato de error en verde.
  - Commit: `8ece910`

- [x] **T04 — Esqueleto del frontend**
  - Descripción: Vite + React + Tailwind 4, tokens de diseño, React Router, TanStack Query, proxy `/api` en desarrollo.
  - Dependencias: T02
  - RN: —
  - Criterios: `npm run build -w apps/web` y un test de render en verde.
  - Commit: `c08e4c8`

## Fase 2 — Backend y base de datos

- [x] **T05 — Esquema de base de datos y migraciones**
  - Descripción: modelos Prisma, migración inicial, restricciones `CHECK` y de exclusión (`btree_gist`), índices, seed demo y harness de PostgreSQL efímero para tests.
  - Dependencias: T03
  - RN: RN-006, RN-012, RN-018, RN-019, RN-020, RN-028
  - Criterios: migración aplicada en PostgreSQL real; test que verifica que la base rechaza superposiciones.
  - Commit: `5dc48eb`

- [x] **T06 — Autenticación y autorización**
  - Descripción: registro de cliente, login, logout, `me`, bcrypt, JWT en cookie `httpOnly`, rate limiting, middleware de roles, perfil y cambio de contraseña.
  - Dependencias: T05
  - RN: RN-024, RN-031, RN-032
  - Criterios: tests de integración de auth (éxito, duplicado, credenciales inválidas, 401/403, 429).
  - Commit: `eaee3d6`

- [x] **T07 — Negocios: onboarding, configuración y catálogo público**
  - Descripción: registro de negocio (admin + negocio), configuración (datos, zona horaria, política de cancelación), listado público con búsqueda y filtro, detalle por slug.
  - Dependencias: T06
  - RN: RN-011, RN-013, RN-025
  - Criterios: tests de integración de onboarding, configuración y catálogo.
  - Commit: `7ff0a90`

- [x] **T08 — Servicios**
  - Descripción: ABM de servicios del administrador (duración, precio en centavos, activar/desactivar) y listado público de activos.
  - Dependencias: T07
  - RN: RN-002, RN-011, RN-017, RN-018, RN-025
  - Criterios: tests de integración de ABM, validaciones y aislamiento.
  - Commit: `74eab0c`

- [x] **T09 — Profesionales**
  - Descripción: ABM de profesionales (con cuenta opcional), asignación de servicios, horarios laborales, permisos y desactivación sin pérdida de historial.
  - Dependencias: T08
  - RN: RN-003, RN-023, RN-030, RN-033
  - Criterios: tests de integración de ABM, horarios inválidos y aislamiento.
  - Commit: `a2f2c62`

- [x] **T10 — Motor de disponibilidad**
  - Descripción: función pura que calcula horarios libres (franjas, reservas, bloqueos, duración, intervalo, horizonte, zona horaria) y endpoint público.
  - Dependencias: T09
  - RN: RN-001, RN-004, RN-005, RN-007, RN-008, RN-012, RN-019, RN-027, RN-034
  - Criterios: tests unitarios exhaustivos (incluye DST) y de integración del endpoint.
  - Commit: `f38a450`

- [x] **T11 — Bloqueos de disponibilidad**
  - Descripción: crear, listar y eliminar bloqueos (admin y profesional autorizado), rechazo si hay reservas activas superpuestas.
  - Dependencias: T10
  - RN: RN-005, RN-029, RN-033
  - Criterios: tests de integración.
  - Commit: `a45ee16`

- [x] **T12 — Creación de reservas**
  - Descripción: reserva de cliente y de administrador con validación completa y traducción de violaciones de exclusión a `409`.
  - Dependencias: T11
  - RN: RN-001–RN-008, RN-017, RN-018, RN-020, RN-025, RN-027, RN-028
  - Criterios: tests de integración y test de concurrencia (N solicitudes simultáneas → 1 éxito).
  - Commit: `c279bd5`

- [x] **T13 — Ciclo de vida de reservas**
  - Descripción: transiciones de estado, cancelación con anticipación mínima, reprogramación con revalidación, permisos por rol.
  - Dependencias: T12
  - RN: RN-009, RN-010, RN-012–RN-016, RN-021, RN-026, RN-033
  - Criterios: tests unitarios de política y de integración.
  - Commit: `63b136b`

- [x] **T14 — Consultas de reservas, clientes y exportación**
  - Descripción: listado de cliente (próximas/pasadas), listado admin con filtros y paginación, agenda del profesional, listado de clientes, exportación CSV.
  - Dependencias: T13
  - RN: RN-009, RN-010, RN-011, RN-021, RN-025
  - Criterios: tests de integración de filtros, ámbitos y CSV.
  - Commit: `c49053f`

- [x] **T15 — Estadísticas y notificaciones**
  - Descripción: métricas agregadas por rango (totales, ingresos, cancelaciones, ocupación, por servicio y profesional) y notificaciones internas ante eventos de reservas.
  - Dependencias: T14
  - RN: RN-022
  - Criterios: tests de integración con datos persistidos.
  - Commit: `fc9826a`

## Fase 3 — Frontend

- [x] **T16 — Sistema de diseño, layouts y autenticación**
  - Descripción: componentes base (botón, inputs, select, tarjeta, badge, diálogo, skeleton, estado vacío, toasts), cliente HTTP, contexto de sesión, rutas protegidas, login, registro y onboarding de negocio.
  - Dependencias: T04, T07
  - RN: RN-024, RN-031
  - Criterios: tests de componentes de formularios y validaciones.
  - Commit: `3b88925`

- [x] **T17 — Catálogo público y flujo de reserva**
  - Descripción: landing, exploración con búsqueda/filtros, página del negocio y asistente de reserva (servicio → profesional → fecha/horario → confirmación).
  - Dependencias: T16, T12
  - RN: RN-001, RN-003, RN-008
  - Criterios: tests de componentes del selector de horarios.
  - Commit: `6413852`

- [x] **T18 — Área del cliente**
  - Descripción: mis reservas (próximas/pasadas), cancelar, reprogramar y perfil.
  - Dependencias: T17, T13
  - RN: RN-009, RN-013, RN-016
  - Criterios: tests de componentes.
  - Commit: `f1d6b7a`

- [x] **T19 — Panel administrativo: dashboard**
  - Descripción: layout de administración y dashboard de métricas.
  - Dependencias: T16, T15
  - RN: RN-022
  - Criterios: test de render con datos.
  - Commit: `7a6682b`

- [x] **T20 — Panel administrativo: servicios y profesionales**
  - Descripción: ABM de servicios y profesionales, asignaciones, horarios y permisos.
  - Dependencias: T19
  - RN: RN-017, RN-023, RN-030, RN-033
  - Criterios: tests de componentes.
  - Commit: `a9b96ee`

- [x] **T21 — Panel administrativo: calendario, reservas, bloqueos, clientes y configuración**
  - Descripción: calendario semanal/mensual, tabla de reservas con filtros y CSV, alta manual, bloqueos, clientes y configuración del negocio.
  - Dependencias: T20
  - RN: RN-011, RN-013, RN-015, RN-029
  - Criterios: tests de componentes del calendario.
  - Commit: `b9f27e5`

- [x] **T22 — Panel del profesional**
  - Descripción: agenda, historial, completar turnos y bloqueos según permisos.
  - Dependencias: T21
  - RN: RN-010, RN-026, RN-033
  - Criterios: tests de componentes.
  - Commit: `f93a3b6`

- [x] **T23 — Notificaciones, responsive y accesibilidad**
  - Descripción: centro de notificaciones, ajustes responsive y de accesibilidad, página 404.
  - Dependencias: T22
  - RN: —
  - Criterios: build y suite de componentes en verde.
  - Commit: `74d93f3`

## Fase 4 — Integración y QA

- [x] **T24 — Tests end-to-end**
  - Descripción: Playwright contra API + web locales con PostgreSQL efímero: registro/login, reserva, cancelación, reprogramación, administración de servicios y profesionales, agenda.
  - Dependencias: T23
  - RN: RN-001, RN-006, RN-013, RN-016, RN-024
  - Criterios: suite E2E en verde.
  - Commit: —

- [ ] **T25 — Revisión de seguridad y documentación de API**
  - Descripción: revisión de autorización, CORS, cookies, secretos; `docs/API.md` completo.
  - Dependencias: T24
  - RN: RN-021, RN-024, RN-025
  - Criterios: checklist de seguridad cumplido; API documentada.
  - Commit: —

## Fase 5 — Producción

- [ ] **T26 — Configuración de despliegue**
  - Descripción: `render.yaml`, `vercel.json`, scripts de build/start de producción, `docs/DEPLOYMENT.md`.
  - Dependencias: T25
  - RN: —
  - Criterios: build de producción local verificado.
  - Commit: —

- [ ] **T27 — Despliegue y smoke tests**
  - Descripción: base en Neon, API en Render, web en Vercel, migraciones y seed, verificación desde URLs públicas.
  - Dependencias: T26
  - RN: —
  - Criterios: health check público OK, login demo y reserva real verificados.
  - Commit: —

## Fase 6 — Auditoría

- [ ] **T28 — Informe de pruebas, README y auditoría final**
  - Descripción: `docs/TEST_REPORT.md` con resultados reales, README completo, verificación contra la consigna.
  - Dependencias: T27
  - RN: todas
  - Criterios: todos los criterios de aceptación del plan verificados.
  - Commit: —

# AGENTS.md — Instrucciones para agentes

Guía obligatoria para cualquier agente (humano o IA) que trabaje en este repositorio. Leela completa antes de modificar código.

## 1. Objetivo del proyecto

**Turnify** es una plataforma SaaS de gestión de turnos para pequeños negocios. Clientes reservan turnos con disponibilidad real; administradores gestionan servicios, profesionales, horarios, bloqueos, reservas y métricas; profesionales consultan su agenda.

Fuentes de verdad:

| Documento                                      | Contenido                                                 |
| ---------------------------------------------- | --------------------------------------------------------- |
| [`docs/SPEC.md`](docs/SPEC.md)                 | Reglas de negocio numeradas (`RN-XXX`) y códigos de error |
| [`docs/PLAN.md`](docs/PLAN.md)                 | Alcance, requisitos, fases, riesgos                       |
| [`docs/TASKS.md`](docs/TASKS.md)               | Estado de cada tarea                                      |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura y decisiones técnicas                        |
| [`docs/API.md`](docs/API.md)                   | Contrato de la API                                        |

## 2. Arquitectura y stack

| Parte             | Stack                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `apps/api`        | Node.js 20+, TypeScript, Express 5, Zod, Prisma, PostgreSQL                               |
| `apps/web`        | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, React Hook Form |
| `packages/shared` | Esquemas Zod, enums, reglas puras compartidas                                             |
| Tests             | Vitest, Supertest, React Testing Library, MSW, Playwright, embedded-postgres              |

## 3. Estructura del repositorio

```
apps/api/prisma/            esquema, migraciones, seed
apps/api/src/modules/<x>/   rutas, servicios, políticas por dominio
apps/api/test/              tests de integración (*.int.test.ts)
apps/web/src/components/ui  sistema de diseño
apps/web/src/features/<x>/  pantallas por dominio
packages/shared/src/        código compartido
e2e/                        tests Playwright
docs/                       documentación
```

## 4. Comandos

| Comando              | Qué hace                                              |
| -------------------- | ----------------------------------------------------- |
| `npm install`        | Instala dependencias de todos los workspaces          |
| `npm run dev`        | API (`:4000`) + web (`:5173`) en modo desarrollo      |
| `npm run db:dev`     | PostgreSQL local efímero para desarrollo (sin Docker) |
| `npm run db:migrate` | Aplica migraciones (`prisma migrate deploy`)          |
| `npm run db:seed`    | Carga datos demo                                      |
| `npm run typecheck`  | Verificación de tipos en todos los workspaces         |
| `npm run lint`       | ESLint                                                |
| `npm test`           | Tests unitarios + integración + componentes           |
| `npm run test:e2e`   | Tests Playwright                                      |
| `npm run build`      | Build de producción                                   |

## 5. Convenciones de código

- **Idioma:** código, identificadores, comentarios y commits en **inglés**. Documentación y textos de interfaz en **español neutro**.
- TypeScript `strict`. Prohibido `any` sin justificación; preferir `unknown` + validación.
- No silenciar errores de TypeScript (`@ts-ignore`) ni desactivar tests.
- Validar toda entrada externa con Zod. Reutilizar los esquemas de `@turnify/shared` en frontend y backend.
- Montos siempre en centavos (`priceCents: number` entero). Nunca aritmética monetaria con decimales.
- Instantes en ISO-8601 UTC; horarios laborales en minutos locales + zona del negocio.
- Errores de negocio: lanzar `AppError` con un código de `docs/SPEC.md`.
- Referenciar la regla en comentarios cuando el código la implementa: `// RN-013`.
- Componentes React: presentacionales en `components/`, lógica de datos en hooks de `features/`.

## 6. Reglas de negocio

Todas las reglas están en [`docs/SPEC.md`](docs/SPEC.md). Las críticas:

- **RN-006/RN-020:** la base de datos impide superposiciones con `EXCLUDE USING gist`. No reemplazar por validaciones en memoria.
- **RN-009/RN-010/RN-011/RN-021/RN-025:** toda consulta por ID incluye el filtro de propietario derivado de la sesión.
- **RN-024:** la autorización se verifica en el backend, nunca solo en la interfaz.

Si una regla cambia, actualizar `SPEC.md`, los tests asociados y este archivo en el mismo commit.

## 7. Estrategia de testing

- Toda regla de negocio nueva o modificada requiere un test que la verifique.
- Tests de integración contra **PostgreSQL real** (efímero, `embedded-postgres`), nunca mocks de la base, nunca producción.
- Lógica pura (disponibilidad, transiciones, políticas) con tests unitarios.
- Frontend: React Testing Library + MSW; E2E con Playwright.
- Registrar resultados reales en `docs/TEST_REPORT.md`. No inventar resultados.

## 8. Seguridad

- Nunca commitear `.env`, tokens, contraseñas, claves ni cadenas de conexión. Usar `.env.example` con valores de ejemplo.
- Antes de cada push revisar el diff en busca de secretos.
- Contraseñas con bcrypt; sesión JWT en cookie `httpOnly`.
- CORS restringido a orígenes configurados.
- Consultas solo vía Prisma (parametrizadas); prohibido interpolar entrada del usuario en SQL crudo.
- Las credenciales demo del seed son públicas y solo para demostración; no reutilizarlas en otro lugar.

## 9. Política de commits

- Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `test(scope): ...`, `docs: ...`, `chore: ...`.
- **Un commit por tarea** de `docs/TASKS.md`, incluyendo el cambio de estado de la tarea, tests y documentación relacionada. Referenciar el ID en el cuerpo (`Task: T07`).
- Sin commits vacíos, sin `git push --force`, sin reescribir historial publicado.

## 10. Definición de tarea completada

Una tarea está completa solo si:

1. La funcionalidad está implementada e integrada (sin botones muertos ni endpoints ficticios).
2. `npm run typecheck`, `npm run lint` y los tests relevantes pasan.
3. Las reglas de negocio afectadas tienen tests.
4. La documentación relacionada está actualizada.
5. La casilla está marcada en `docs/TASKS.md` y el hash de la tarea anterior registrado.
6. Existe el commit correspondiente y fue pusheado.

## 11. Actualización de documentación

| Si cambiás…                             | Actualizá…                                |
| --------------------------------------- | ----------------------------------------- |
| Una regla de negocio                    | `docs/SPEC.md` y sus tests                |
| Un endpoint                             | `docs/API.md`                             |
| Arquitectura, dependencias o decisiones | `docs/ARCHITECTURE.md`                    |
| Comandos o variables de entorno         | `README.md`, `.env.example`, este archivo |
| El estado de una tarea                  | `docs/TASKS.md`                           |
| Resultados de tests                     | `docs/TEST_REPORT.md`                     |

## 12. Reanudar trabajo

1. `git status` y `git log --oneline -10`.
2. Leer `docs/TASKS.md` y tomar la primera tarea pendiente cuyas dependencias estén completas.
3. No repetir tareas completadas ni sobrescribir trabajo válido.

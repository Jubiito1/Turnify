# Turnify — Especificación de reglas de negocio

Este documento define las reglas de negocio de Turnify. Cada regla tiene un identificador único (`RN-XXX`) que se referencia desde el código, los tests y `docs/TASKS.md`.

> **Cómo leer este documento:** la tabla resumen permite ubicar una regla rápidamente; el detalle de cada regla incluye justificación, criterios de aceptación verificables, componentes involucrados y tests asociados.

## Glosario

| Término                  | Significado                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Negocio                  | Comercio que ofrece servicios con turno (peluquería, consultorio, estudio, etc.). Es la unidad de aislamiento de datos (tenant). |
| Administrador            | Usuario dueño/gestor de **un** negocio.                                                                                          |
| Profesional              | Persona que presta servicios dentro de un negocio. Puede tener o no cuenta de acceso.                                            |
| Cliente                  | Usuario que reserva turnos en cualquier negocio.                                                                                 |
| Reserva activa           | Reserva en estado `PENDING` o `CONFIRMED`. Solo las reservas activas ocupan disponibilidad.                                      |
| Bloqueo                  | Intervalo en el que un profesional no atiende (vacaciones, trámite, feriado).                                                    |
| Zona horaria del negocio | Zona IANA (por ejemplo `America/Argentina/Buenos_Aires`) usada para interpretar horarios laborales y mostrar fechas.             |

## Estados de una reserva

| Estado      | Significado                                       | Transiciones válidas                |
| ----------- | ------------------------------------------------- | ----------------------------------- |
| `PENDING`   | Solicitada, pendiente de confirmación del negocio | `CONFIRMED`, `CANCELLED`            |
| `CONFIRMED` | Confirmada                                        | `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `COMPLETED` | Servicio prestado                                 | — (estado final)                    |
| `CANCELLED` | Cancelada por cliente o negocio                   | — (estado final)                    |
| `NO_SHOW`   | El cliente no asistió                             | — (estado final)                    |

## Resumen de reglas

| ID     | Regla                                                                              |
| ------ | ---------------------------------------------------------------------------------- |
| RN-001 | No se puede reservar un turno en el pasado.                                        |
| RN-002 | Una reserva debe corresponder a un servicio activo.                                |
| RN-003 | El profesional debe estar habilitado para prestar el servicio.                     |
| RN-004 | El turno debe estar dentro del horario laboral del profesional.                    |
| RN-005 | No se pueden reservar horarios bloqueados.                                         |
| RN-006 | Dos reservas activas del mismo profesional no pueden superponerse.                 |
| RN-007 | La duración del turno depende del servicio seleccionado.                           |
| RN-008 | La disponibilidad considera duración, reservas, horarios y bloqueos.               |
| RN-009 | Un cliente solo consulta y gestiona sus propias reservas.                          |
| RN-010 | Un profesional solo consulta reservas de su ámbito autorizado.                     |
| RN-011 | Un administrador solo gestiona recursos de su negocio.                             |
| RN-012 | Las reservas canceladas no bloquean disponibilidad.                                |
| RN-013 | La cancelación del cliente respeta la anticipación mínima configurada.             |
| RN-014 | No se puede completar una reserva cancelada.                                       |
| RN-015 | Los cambios de estado siguen transiciones válidas.                                 |
| RN-016 | La reprogramación vuelve a validar disponibilidad.                                 |
| RN-017 | Un servicio desactivado no admite nuevas reservas.                                 |
| RN-018 | Los precios se almacenan en unidades monetarias enteras (centavos).                |
| RN-019 | Las fechas se persisten en UTC y se interpretan en la zona horaria del negocio.    |
| RN-020 | La creación de reservas es atómica y segura ante concurrencia.                     |
| RN-021 | Los clientes no pueden modificar reservas ajenas manipulando identificadores.      |
| RN-022 | Las estadísticas se calculan a partir de datos persistidos.                        |
| RN-023 | Desactivar un profesional no elimina su historial.                                 |
| RN-024 | Las operaciones administrativas se autorizan en el backend.                        |
| RN-025 | Los datos de un negocio están aislados de los demás negocios.                      |
| RN-026 | Solo se puede completar o marcar ausente una reserva cuyo horario ya comenzó.      |
| RN-027 | Las reservas solo se aceptan dentro del horizonte de reserva del negocio.          |
| RN-028 | Un cliente no puede tener dos reservas activas superpuestas.                       |
| RN-029 | Un bloqueo no puede superponerse con reservas activas del profesional.             |
| RN-030 | Los horarios laborales de un profesional son válidos y no se superponen.           |
| RN-031 | Las credenciales cumplen requisitos mínimos y el email es único.                   |
| RN-032 | Los intentos de autenticación están limitados para prevenir fuerza bruta.          |
| RN-033 | Los profesionales solo gestionan bloqueos o completan turnos si están autorizados. |
| RN-034 | Las reservas se alinean al intervalo de turnos del negocio.                        |

---

## Detalle de reglas

### RN-001 — No se puede reservar en el pasado

- **Descripción:** el inicio de una reserva (nueva o reprogramada) debe ser posterior al instante actual del servidor.
- **Justificación:** un turno en el pasado no puede prestarse y distorsiona agenda y estadísticas.
- **Criterios de aceptación:**
  - `POST /api/bookings` con `startsAt` anterior a "ahora" responde `422` con código `BOOKING_IN_PAST`.
  - El motor de disponibilidad nunca devuelve horarios anteriores a "ahora".
- **Componentes:** `apps/api/src/modules/bookings/booking.service.ts`, `apps/api/src/modules/availability/availability.engine.ts`.
- **Tests:** `availability.engine.test.ts` (descarta pasado), `bookings.int.test.ts` (rechaza pasado).

### RN-002 — La reserva corresponde a un servicio activo

- **Descripción:** el servicio debe existir, pertenecer al negocio y estar activo.
- **Justificación:** evita reservar prestaciones que el negocio ya no ofrece.
- **Criterios de aceptación:** reservar un servicio inexistente o de otro negocio responde `404`; uno inactivo responde `422` con código `SERVICE_INACTIVE`.
- **Componentes:** `booking.service.ts`.
- **Tests:** `bookings.int.test.ts`.

### RN-003 — Profesional habilitado para el servicio

- **Descripción:** debe existir la asignación profesional–servicio y el profesional debe estar activo.
- **Justificación:** no todos los profesionales prestan todos los servicios.
- **Criterios de aceptación:** reservar con un profesional no asignado o inactivo responde `422` con código `PROFESSIONAL_NOT_ELIGIBLE`; el listado público de profesionales por servicio solo muestra elegibles.
- **Componentes:** `booking.service.ts`, `catalog.routes.ts`.
- **Tests:** `bookings.int.test.ts`.

### RN-004 — Dentro del horario laboral

- **Descripción:** el intervalo completo `[inicio, fin)` del turno debe caber en una franja laboral del profesional para ese día de la semana, interpretada en la zona horaria del negocio.
- **Justificación:** el profesional solo atiende en sus horarios.
- **Criterios de aceptación:** un turno que empieza o termina fuera de franja responde `409` con código `SLOT_UNAVAILABLE`; el motor no ofrece esos horarios.
- **Componentes:** `availability.engine.ts`, `booking.service.ts`.
- **Tests:** `availability.engine.test.ts`, `bookings.int.test.ts`.

### RN-005 — Horarios bloqueados no reservables

- **Descripción:** un turno no puede intersectar un bloqueo del profesional.
- **Justificación:** respeta ausencias y excepciones.
- **Criterios de aceptación:** reservar sobre un bloqueo responde `409` (`SLOT_UNAVAILABLE`); el motor excluye esos horarios.
- **Componentes:** `availability.engine.ts`, `booking.service.ts`, `blocks` module.
- **Tests:** `availability.engine.test.ts`, `bookings.int.test.ts`.

### RN-006 — Sin superposición de reservas del profesional

- **Descripción:** dos reservas activas del mismo profesional no pueden intersectarse (intervalos semiabiertos `[inicio, fin)`; turnos contiguos sí están permitidos).
- **Justificación:** un profesional no puede atender dos turnos a la vez.
- **Criterios de aceptación:** la base de datos rechaza la segunda reserva mediante una restricción de exclusión; la API responde `409` (`SLOT_TAKEN`).
- **Componentes:** migración `booking_no_overlap`, `booking.service.ts`.
- **Tests:** `bookings.int.test.ts`, `concurrency.int.test.ts`.

### RN-007 — Duración según el servicio

- **Descripción:** `endsAt = startsAt + duración del servicio`. El cliente no envía la hora de fin.
- **Justificación:** evita turnos de duración arbitraria.
- **Criterios de aceptación:** la reserva persistida tiene `endsAt` calculado en el servidor; cualquier `endsAt` enviado se ignora.
- **Componentes:** `booking.service.ts`.
- **Tests:** `bookings.int.test.ts`.

### RN-008 — Cálculo de disponibilidad real

- **Descripción:** un horario es disponible si (a) cae dentro de una franja laboral, (b) no intersecta reservas activas, (c) no intersecta bloqueos, (d) es futuro, (e) está dentro del horizonte y (f) cabe completo según la duración del servicio.
- **Justificación:** el cliente debe ver solo horarios efectivamente reservables.
- **Criterios de aceptación:** `GET /api/businesses/:slug/availability` devuelve horarios que cumplen todas las condiciones; reservar cualquiera de ellos tiene éxito si no cambió el estado.
- **Componentes:** `availability.engine.ts`, `availability.service.ts`.
- **Tests:** `availability.engine.test.ts`, `availability.int.test.ts`.

### RN-009 — El cliente gestiona solo sus reservas

- **Descripción:** listados, detalle, cancelación y reprogramación de cliente se filtran por `clientId = usuario autenticado`.
- **Justificación:** privacidad de los clientes.
- **Criterios de aceptación:** acceder a una reserva ajena responde `404` (no se revela su existencia).
- **Componentes:** `bookings` module (rutas de cliente).
- **Tests:** `authorization.int.test.ts`.

### RN-010 — Ámbito del profesional

- **Descripción:** un profesional con cuenta solo ve las reservas donde él es el profesional asignado.
- **Justificación:** mínimo privilegio.
- **Criterios de aceptación:** `GET /api/pro/bookings` nunca devuelve reservas de otro profesional; modificar una reserva ajena responde `404`.
- **Componentes:** `professional-panel` module.
- **Tests:** `authorization.int.test.ts`.

### RN-011 — El administrador gestiona solo su negocio

- **Descripción:** todas las operaciones `/api/admin/*` se restringen al `businessId` del administrador autenticado, derivado del token y nunca de un parámetro enviado por el cliente.
- **Justificación:** multi-tenancy seguro.
- **Criterios de aceptación:** intentar editar un servicio, profesional, bloqueo o reserva de otro negocio responde `404`.
- **Componentes:** middleware `requireRole`, repositorios con filtro `businessId`.
- **Tests:** `isolation.int.test.ts`.

### RN-012 — Las canceladas no bloquean disponibilidad

- **Descripción:** las reservas `CANCELLED` (y también `COMPLETED`/`NO_SHOW`, que son pasadas) no ocupan disponibilidad.
- **Justificación:** liberar el horario permite que otro cliente lo tome.
- **Criterios de aceptación:** tras cancelar, el horario vuelve a aparecer en la disponibilidad y puede reservarse. La restricción de exclusión aplica solo a estados activos.
- **Componentes:** restricción parcial `WHERE status IN ('PENDING','CONFIRMED')`, `availability.service.ts`.
- **Tests:** `bookings.int.test.ts`.

### RN-013 — Anticipación mínima para cancelar

- **Descripción:** un cliente puede cancelar o reprogramar solo si faltan al menos `cancellationMinHours` horas (configurable por negocio, por defecto 24) para el inicio del turno. El administrador puede cancelar en cualquier momento.
- **Justificación:** protege al negocio de cancelaciones sobre la hora.
- **Criterios de aceptación:** cancelar dentro de la ventana responde `422` (`CANCELLATION_WINDOW_PASSED`).
- **Componentes:** `booking.policy.ts`.
- **Tests:** `booking.policy.test.ts`, `bookings.int.test.ts`.

### RN-014 — No se completa una reserva cancelada

- **Descripción:** caso particular de RN-015, explicitado por su relevancia.
- **Criterios de aceptación:** `CANCELLED → COMPLETED` responde `422` (`INVALID_TRANSITION`).
- **Componentes:** `booking.policy.ts`.
- **Tests:** `booking.policy.test.ts`, `bookings.int.test.ts`.

### RN-015 — Transiciones de estado válidas

- **Descripción:** solo se permiten las transiciones de la tabla "Estados de una reserva".
- **Justificación:** coherencia del ciclo de vida.
- **Criterios de aceptación:** cualquier otra transición responde `422` (`INVALID_TRANSITION`).
- **Componentes:** `packages/shared/src/booking-status.ts`, `booking.policy.ts`.
- **Tests:** `booking-status.test.ts`, `booking.policy.test.ts`.

### RN-016 — La reprogramación revalida disponibilidad

- **Descripción:** reprogramar aplica RN-001, RN-004, RN-005, RN-006, RN-013, RN-027 y RN-028 sobre el nuevo horario. La reserva no colisiona consigo misma.
- **Justificación:** una reprogramación es equivalente a una nueva reserva.
- **Criterios de aceptación:** reprogramar a un horario ocupado responde `409`; a uno libre actualiza `startsAt`/`endsAt` y mantiene el identificador.
- **Componentes:** `booking.service.ts`.
- **Tests:** `bookings.int.test.ts`.

### RN-017 — Servicio desactivado sin nuevas reservas

- **Descripción:** desactivar un servicio no elimina reservas existentes, pero impide crear nuevas y lo oculta del catálogo público.
- **Criterios de aceptación:** tras desactivar, el servicio no aparece en el catálogo y reservarlo responde `422` (`SERVICE_INACTIVE`).
- **Componentes:** `services` module, `catalog` module.
- **Tests:** `services.int.test.ts`.

### RN-018 — Montos en enteros

- **Descripción:** los precios se guardan como enteros en centavos (`priceCents`). La reserva guarda una copia del precio vigente al reservar. Las sumas de facturación se hacen en enteros.
- **Justificación:** evitar errores de redondeo de punto flotante.
- **Criterios de aceptación:** el esquema usa `Int`; la validación rechaza precios no enteros o negativos; la reserva conserva su precio aunque el servicio cambie.
- **Componentes:** `schema.prisma`, `packages/shared/src/money.ts`.
- **Tests:** `money.test.ts`, `bookings.int.test.ts`.

### RN-019 — Fechas consistentes y zona horaria

- **Descripción:** los instantes se persisten como `timestamptz` (UTC). Los horarios laborales se guardan como minutos desde la medianoche local y se interpretan en la zona horaria del negocio, incluyendo cambios de horario de verano.
- **Criterios de aceptación:** la API intercambia ISO-8601 con zona; el motor de disponibilidad convierte usando la zona del negocio.
- **Componentes:** `availability.engine.ts`, `schema.prisma`.
- **Tests:** `availability.engine.test.ts` (zonas distintas y cambio de horario).

### RN-020 — Creación atómica y segura ante concurrencia

- **Descripción:** la garantía final contra superposición es una restricción de exclusión de PostgreSQL (`EXCLUDE USING gist`), no una consulta previa. Las validaciones previas mejoran los mensajes, pero la base de datos es la autoridad.
- **Criterios de aceptación:** N solicitudes simultáneas por el mismo horario producen exactamente 1 reserva y N-1 respuestas `409`.
- **Componentes:** migración `booking_no_overlap`, `booking.service.ts`.
- **Tests:** `concurrency.int.test.ts`.

### RN-021 — Protección contra IDOR

- **Descripción:** toda consulta por identificador incluye el filtro de propietario (cliente, profesional o negocio).
- **Criterios de aceptación:** cambiar el ID en la URL por el de un recurso ajeno responde `404`.
- **Componentes:** repositorios y servicios de cada módulo.
- **Tests:** `authorization.int.test.ts`, `isolation.int.test.ts`.

### RN-022 — Estadísticas reales

- **Descripción:** las métricas del panel se calculan con consultas agregadas sobre reservas persistidas en el rango pedido.
- **Criterios de aceptación:** tras crear/completar reservas, los totales cambian en consecuencia; los ingresos suman solo reservas `COMPLETED`.
- **Componentes:** `stats` module.
- **Tests:** `stats.int.test.ts`.

### RN-023 — Desactivar profesional conserva historial

- **Descripción:** los profesionales se desactivan (`isActive = false`), nunca se borran si tienen reservas.
- **Criterios de aceptación:** un profesional inactivo no aparece en el catálogo ni recibe reservas, pero sus reservas históricas siguen consultables.
- **Componentes:** `professionals` module.
- **Tests:** `professionals.int.test.ts`.

### RN-024 — Autorización en el backend

- **Descripción:** cada endpoint protegido verifica autenticación y rol en el servidor. La interfaz oculta acciones, pero no es una barrera de seguridad.
- **Criterios de aceptación:** un cliente que llama a `/api/admin/*` recibe `403`; sin sesión, `401`.
- **Componentes:** `auth.middleware.ts`.
- **Tests:** `authorization.int.test.ts`.

### RN-025 — Aislamiento entre negocios

- **Descripción:** ninguna respuesta de un negocio expone datos de otro; las relaciones (servicio, profesional, reserva) se validan como pertenecientes al mismo negocio.
- **Criterios de aceptación:** reservar el servicio de un negocio con un profesional de otro responde `422`/`404`; listados administrativos solo contienen datos propios.
- **Componentes:** todos los módulos administrativos, `booking.service.ts`.
- **Tests:** `isolation.int.test.ts`.

### RN-026 — Completar solo turnos iniciados

- **Descripción:** `COMPLETED` y `NO_SHOW` solo pueden asignarse si `startsAt <= ahora`.
- **Justificación:** no se puede prestar ni faltar a un turno futuro.
- **Criterios de aceptación:** intentarlo antes responde `422` (`BOOKING_NOT_STARTED`).
- **Componentes:** `booking.policy.ts`.
- **Tests:** `booking.policy.test.ts`.

### RN-027 — Horizonte de reserva

- **Descripción:** solo se aceptan reservas que comiencen dentro de los próximos `bookingHorizonDays` días (por defecto 60).
- **Criterios de aceptación:** reservar más allá responde `422` (`BEYOND_BOOKING_HORIZON`); el motor no ofrece esos días.
- **Componentes:** `availability.engine.ts`, `booking.service.ts`.
- **Tests:** `availability.engine.test.ts`, `bookings.int.test.ts`.

### RN-028 — Cliente sin reservas superpuestas

- **Descripción:** un cliente no puede tener dos reservas activas que se intersecten, aunque sean en negocios distintos.
- **Justificación:** una persona no puede estar en dos turnos a la vez.
- **Criterios de aceptación:** restricción de exclusión por `clientId`; la API responde `409` (`CLIENT_OVERLAP`).
- **Componentes:** migración `booking_client_no_overlap`.
- **Tests:** `bookings.int.test.ts`.

### RN-029 — Bloqueos sin reservas activas superpuestas

- **Descripción:** no se puede crear un bloqueo que intersecte reservas activas; primero deben cancelarse o reprogramarse.
- **Criterios de aceptación:** responde `409` (`BLOCK_CONFLICTS_WITH_BOOKINGS`) incluyendo la cantidad de reservas en conflicto.
- **Componentes:** `blocks` module.
- **Tests:** `blocks.int.test.ts`.

### RN-030 — Horarios laborales válidos

- **Descripción:** cada franja cumple `0 <= inicio < fin <= 1440` minutos, día de semana 0–6, y las franjas del mismo día no se superponen.
- **Criterios de aceptación:** guardar franjas inválidas responde `400` con detalle del error.
- **Componentes:** `packages/shared/src/schemas/professional.ts`.
- **Tests:** `schemas.test.ts`, `professionals.int.test.ts`.

### RN-031 — Credenciales mínimas

- **Descripción:** email válido y único (sin distinguir mayúsculas); contraseña de 8 a 72 caracteres con al menos una letra y un número; se almacena solo el hash bcrypt.
- **Criterios de aceptación:** registro duplicado responde `409` (`EMAIL_TAKEN`); contraseña débil responde `400`; la columna nunca contiene texto plano.
- **Componentes:** `auth` module, `packages/shared/src/schemas/auth.ts`.
- **Tests:** `auth.int.test.ts`, `schemas.test.ts`.

### RN-032 — Límite de intentos de autenticación

- **Descripción:** los endpoints de login y registro aceptan un máximo de intentos por IP en una ventana de tiempo.
- **Criterios de aceptación:** superar el límite responde `429` (`TOO_MANY_REQUESTS`).
- **Componentes:** `rate-limit.ts`.
- **Tests:** `auth.int.test.ts`.

### RN-033 — Permisos de profesionales

- **Descripción:** el administrador habilita por profesional `canManageBlocks` y `canCompleteBookings`. Sin el permiso, el backend rechaza la acción.
- **Criterios de aceptación:** sin permiso responde `403` (`PERMISSION_DENIED`).
- **Componentes:** `professional-panel` module.
- **Tests:** `authorization.int.test.ts`.

### RN-034 — Alineación al intervalo de turnos

- **Descripción:** los inicios de turno se alinean al `slotIntervalMinutes` del negocio (por defecto 15) medido desde el inicio de cada franja laboral.
- **Justificación:** agenda ordenada y predecible.
- **Criterios de aceptación:** un inicio desalineado responde `409` (`SLOT_UNAVAILABLE`); el motor solo genera inicios alineados.
- **Componentes:** `availability.engine.ts`.
- **Tests:** `availability.engine.test.ts`.

## Códigos de error de la API

Todas las respuestas de error tienen la forma `{ "error": { "code": string, "message": string, "details"?: unknown } }`.

| HTTP | Código                                                                                                                                                                  | Uso                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                                                                                                                                                      | Entrada inválida (Zod).                             |
| 401  | `UNAUTHENTICATED` / `INVALID_CREDENTIALS`                                                                                                                               | Sin sesión o credenciales incorrectas.              |
| 403  | `FORBIDDEN` / `PERMISSION_DENIED`                                                                                                                                       | Rol o permiso insuficiente.                         |
| 404  | `NOT_FOUND`                                                                                                                                                             | Recurso inexistente o fuera del ámbito del usuario. |
| 409  | `SLOT_TAKEN`, `SLOT_UNAVAILABLE`, `CLIENT_OVERLAP`, `EMAIL_TAKEN`, `SLUG_TAKEN`, `BLOCK_CONFLICTS_WITH_BOOKINGS`                                                        | Conflictos de estado.                               |
| 422  | `BOOKING_IN_PAST`, `SERVICE_INACTIVE`, `PROFESSIONAL_NOT_ELIGIBLE`, `CANCELLATION_WINDOW_PASSED`, `INVALID_TRANSITION`, `BOOKING_NOT_STARTED`, `BEYOND_BOOKING_HORIZON` | Violación de reglas de negocio.                     |
| 429  | `TOO_MANY_REQUESTS`                                                                                                                                                     | Límite de intentos.                                 |
| 500  | `INTERNAL_ERROR`                                                                                                                                                        | Error inesperado (sin detalles internos).           |

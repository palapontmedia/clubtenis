# Rally — Club Tenis & Pádel

Plataforma de reservas para un club de tenis y pádel: disponibilidad en tiempo real, motor de precios configurable, pagos con Stripe y un panel de administración operativo completo.

Producto único (`Club de Tenis de Oliva`, ver `prisma/seed.ts`) inspirado funcionalmente en plataformas de reserva de pistas del mercado, con identidad visual e implementación propias.

## Índice

- [Arquitectura](#arquitectura)
- [Stack](#stack)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos](#base-de-datos)
- [Stripe](#stripe)
- [Testing](#testing)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Seguridad](#seguridad)
- [Despliegue](#despliegue)

## Arquitectura

Next.js App Router con Server Components para lectura de datos, Server Actions para mutaciones administrativas y Route Handlers (`/api/*`) para las operaciones que necesitan un contrato HTTP explícito (disponibilidad, reservas, pagos, webhook de Stripe, auth).

Decisiones de diseño relevantes:

- **La disponibilidad no se persiste.** `AvailabilitySlot` no es una tabla: se calcula on-demand en `src/lib/availability.ts` a partir de horarios de apertura, cierres/mantenimiento y reservas existentes. Persistir slots generaría una segunda fuente de verdad que podría desincronizarse.
- **Anti double-booking en dos capas.** La capa de aplicación re-valida el hueco antes de insertar, pero la garantía real es una *exclusion constraint* de PostgreSQL (`btree_gist`) sobre `(courtId, tsrange(startsAt, endsAt))` filtrada a reservas activas — ver `prisma/migrations/*_init/migration.sql`. Aunque dos requests pasen la comprobación de aplicación a la vez, Postgres solo permite que una de las dos inserciones tenga éxito.
- **Estado de reserva ≠ estado de pago.** `Reservation.status` (`PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `EXPIRED`, `NO_SHOW`) y `Payment.status` (`PENDING`, `SUCCEEDED`, `FAILED`, ...) son conceptos independientes. Una reserva nunca pasa a `CONFIRMED` porque el frontend reciba una respuesta de Stripe: solo el webhook verificado puede confirmar un pago (`src/lib/payments.ts`).
- **Reserva temporal (hold).** Al iniciar una reserva se crea en `PENDING_PAYMENT` con `expiresAt = now + RESERVATION_HOLD_MINUTES`. La expiración se aplica de forma perezosa en cada lectura de disponibilidad/creación (`expireStalePendingReservations`) y además hay un endpoint de barrido (`/api/cron/expire-reservations`) para limpiar holds abandonados que nadie vuelve a consultar.
- **Motor de precios configurable.** `PricingRule` combina deporte, tipo de pista (opcional), categoría de día (`WEEKDAY`/`WEEKEND`/`HOLIDAY`) y franja horaria con un precio por hora. `src/lib/pricing.ts` prorratea automáticamente una reserva que cruza dos franjas (p. ej. empieza en valle y termina en punta) y cae al `Court.basePriceCents` si ninguna regla aplica. El precio se calcula **siempre en el servidor**; nunca se confía en un precio enviado por el cliente.
- **Política de cancelación configurable.** `CancellationPolicy` + `CancellationPolicyTier` (horas de antelación → % de reembolso) por club, evaluada en `src/lib/cancellation.ts`.
- **Reembolso automático ante condición de carrera pago↔expiración.** Si el hold expira justo antes de que llegue el webhook de pago confirmado, la pista puede haber sido ocupada por otra persona mientras tanto. En ese caso `src/lib/payments.ts` reembolsa automáticamente el cargo en vez de dejar al usuario cobrado sin reserva.

No se implementó (fuera de alcance del MVP, documentado para transparencia):

- Notificaciones push reales y proveedor de email real (hay una abstracción `notify()` en `src/lib/notifications.ts` con un mock de email; cambiar de proveedor es sustituir una función).
- Multi-club: el modelo de datos lo soporta (`Club` es una entidad más), pero la UI de jugador asume un único club (`getDefaultClub()`).

## Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, TypeScript estricto, Tailwind CSS v4, componentes propios en el estilo shadcn/ui sobre Radix UI, React Hook Form + Zod, TanStack Query.
- **Backend:** Server Actions y Route Handlers de Next.js.
- **Base de datos:** PostgreSQL + Prisma ORM.
- **Auth:** Auth.js (NextAuth v5) con credenciales (email/contraseña), sesiones JWT, recuperación de contraseña por token de un solo uso.
- **Pagos:** Stripe (Payment Intents + webhooks).
- **Testing:** Vitest, contra una base de datos Postgres real (ver [Testing](#testing)).

## Puesta en marcha

Requisitos: Node 20+, pnpm, PostgreSQL 13+ (con capacidad de crear la extensión `btree_gist`).

```bash
pnpm install
cp .env.example .env   # y rellena las variables, ver más abajo
pnpm db:migrate         # crea el esquema (incluye la exclusion constraint)
pnpm db:seed             # datos de ejemplo: club, pistas, tarifas, usuarios, reservas
pnpm dev
```

Usuarios de prueba tras el seed (contraseña `Password123` para todos):

| Rol          | Email                        |
| ------------ | ----------------------------- |
| SUPER_ADMIN  | admin@clubtenisoliva.example    |
| STAFF        | staff@clubtenisoliva.example    |
| PLAYER       | ana.garcia@example.com         |

## Variables de entorno

Ver [`.env.example`](./.env.example). Resumen:

| Variable                              | Descripción                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`                         | Cadena de conexión PostgreSQL.                                              |
| `NEXTAUTH_SECRET`                      | Secreto para firmar las sesiones JWT (`openssl rand -base64 32`).           |
| `NEXTAUTH_URL`                         | URL base de la app.                                                          |
| `STRIPE_SECRET_KEY`                    | Clave secreta de Stripe (server-only, nunca se expone al cliente).          |
| `STRIPE_WEBHOOK_SECRET`                | Secreto para verificar la firma del webhook de Stripe.                      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`   | Clave pública de Stripe, usada por Stripe Elements en el checkout.           |
| `RESERVATION_HOLD_MINUTES`             | Minutos que se bloquea una pista mientras el usuario paga (por defecto 15). |
| `CRON_SECRET`                          | Opcional. Token para proteger `/api/cron/expire-reservations` en producción.|

## Base de datos

El esquema completo está en [`prisma/schema.prisma`](./prisma/schema.prisma), con comentarios explicando las decisiones no obvias. Comandos habituales:

```bash
pnpm db:migrate    # prisma migrate dev
pnpm db:seed       # prisma db seed
pnpm db:studio     # explorar los datos con Prisma Studio
```

La migración inicial (`prisma/migrations/*_init/migration.sql`) incluye, además del SQL generado por Prisma, la creación de la extensión `btree_gist` y la exclusion constraint que impide el double-booking a nivel de base de datos.

## Stripe

Flujo: el usuario elige pista → el servidor calcula el precio → se crea una reserva `PENDING_PAYMENT` (con hold temporal) → el servidor crea un `PaymentIntent` → el usuario paga con Stripe Elements → Stripe envía un webhook → el servidor verifica la firma, aplica idempotencia por `event.id` y, solo entonces, confirma la reserva.

Para probar webhooks en local con la Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copia el `whsec_...` que imprime a `STRIPE_WEBHOOK_SECRET`. Usa las [tarjetas de prueba de Stripe](https://stripe.com/docs/testing) para simular pagos correctos y fallidos.

## Testing

```bash
pnpm test
```

Los tests de lógica de negocio (`tests/*.test.ts`) corren contra una base de datos Postgres real — mockear Prisma no probaría nada útil para la disponibilidad, el motor de precios o la exclusion constraint anti double-booking. Configura una base de datos de test aparte y apúntala en `.env.test`:

```bash
createdb clubtenis_test
DATABASE_URL="postgresql://user:password@localhost:5432/clubtenis_test" pnpm exec prisma migrate deploy
```

Cobertura actual:

- **Pricing** (`tests/pricing.test.ts`): tarifa valle/punta, fin de semana, prorrateo de una reserva que cruza una franja, fallback al precio base de la pista.
- **Availability** (`tests/availability.test.ts`): pista libre, pista ocupada, solapamientos parciales, bloqueo por mantenimiento, fuera de horario, expiración perezosa de holds `PENDING_PAYMENT`.
- **Reservations** (`tests/reservations.test.ts`): creación con precio calculado en servidor, **doble reserva concurrente sobre el mismo hueco** (solo una de las dos requests puede tener éxito), política de cancelación y reembolso, autorización (un jugador no puede cancelar la reserva de otro).
- **Authorization** (`tests/auth-guards.test.ts`): ranking de roles `PLAYER < STAFF < ADMIN < SUPER_ADMIN`.
- **Cancellation policy** (`tests/cancellation.test.ts`): selección del tramo de reembolso correcto según antelación.

## Estructura del proyecto

```
prisma/
  schema.prisma        Modelo de datos completo, comentado
  migrations/           Incluye la exclusion constraint anti double-booking
  seed.ts                Datos de ejemplo
src/
  app/
    (player pages)       /, /search, /booking/[id], /dashboard, /reservations, /profile
    admin/                 Panel de administración (protegido por rol STAFF+)
    api/                    Route handlers: availability, reservations, payments, webhook de Stripe, auth
  components/
    ui/                    Sistema de componentes (botón, card, dialog, sheet, tabs...)
    booking/                Búsqueda, resultados, checkout, historial
    admin/                  Formularios y diálogos del panel admin
  lib/
    availability.ts        Motor de disponibilidad
    pricing.ts               Motor de precios
    reservations.ts          Servicio de reservas (creación, cancelación, confirmación)
    cancellation.ts           Política de cancelación
    payments.ts                Integración con Stripe
    auth.ts / auth-guards.ts   Auth.js y guards de autorización server-side
    actions/                    Server Actions del panel admin
    validation/                  Esquemas Zod
tests/                       Tests de lógica de negocio (Vitest + Postgres real)
```

## Seguridad

- Autorización basada en roles (`PLAYER`, `STAFF`, `ADMIN`, `SUPER_ADMIN`) validada **siempre en servidor** — `src/lib/auth-guards.ts`, usado tanto en Server Components (`requireStaffOrRedirect`) como en Server Actions/Route Handlers (`requireRole`, que lanza en vez de redirigir).
- Protección IDOR: `GET /api/reservations/[id]` verifica que el usuario autenticado sea el creador, un participante, o personal del club antes de devolver los datos.
- Cambios de rol de usuario protegidos contra escalada de privilegios: solo `SUPER_ADMIN` puede conceder o modificar roles `ADMIN`/`SUPER_ADMIN` (`src/lib/actions/users.ts`).
- El precio de una reserva siempre se calcula en servidor; el cliente nunca puede manipular el importe a cobrar.
- Todos los payloads de API se validan con Zod antes de tocar la base de datos.
- Rate limiting básico en login, registro y recuperación de contraseña (`src/lib/rate-limit.ts`).
- El webhook de Stripe verifica la firma (`stripe.webhooks.constructEvent`) y es idempotente por `event.id` (tabla `StripeWebhookEvent`).
- Secretos únicamente en variables de entorno; nunca se exponen al cliente (la clave pública de Stripe es la única `NEXT_PUBLIC_*`).
- `AuditLog` registra las acciones administrativas sensibles (cambios de rol, reembolsos manuales, cancelaciones, cambios de precios/horarios...).

## Despliegue

1. Provisiona una base de datos PostgreSQL con soporte para `btree_gist` (Neon, Supabase, RDS, etc.).
2. Configura las variables de entorno de producción (ver arriba).
3. `pnpm build && pnpm start`, o despliega en Vercel (recomendado para Next.js).
4. Configura el webhook de Stripe en el dashboard apuntando a `https://tu-dominio/api/webhooks/stripe`.
5. Programa una llamada periódica (cada minuto) a `POST /api/cron/expire-reservations` con `Authorization: Bearer <CRON_SECRET>` como backstop de la expiración perezosa de holds.

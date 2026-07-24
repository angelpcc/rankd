# Conectar pagos reales a la venta de entradas

Ahora mismo el flujo de entradas está **completo a nivel de producto pero sin cobro online**:

- Una promotora/gimnasio crea **tipos de entrada** por evento (nombre, precio, aforo) desde su panel → botón 🎫 en cada evento.
- El público ve el evento en `/evento/:id`, elige entrada y cantidad y pulsa **Reservar**.
- Se crea una fila en `ticket_orders` con estado `pending` y un trigger sube `quantity_sold` para llevar el aforo real.
- La promotora ve las reservas (contador) en el gestor de entradas.

Falta **cobrar de verdad**. Recomendación: **Stripe Checkout** (lo más rápido y seguro; el dinero no pasa por RANKD, va directo a la promotora con Stripe Connect).

## Lo que necesitarías

1. **Cuenta de Stripe** (y Stripe Connect si quieres que cada promotora cobre en su propia cuenta y RANKD se lleve una comisión).
2. **Claves**: `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` como variables de entorno del backend (nunca en el front). La `publishable key` sí puede ir en el front.
3. **Dos endpoints** (sirve una Edge Function de Supabase o una función serverless en `/api`):
   - `POST /api/checkout` → recibe `ticket_id` y `quantity`, valida stock (`quantity_total - quantity_sold`), crea la `Checkout Session` de Stripe con el importe de `event_tickets.price_cents`, y devuelve la URL de pago. Antes de redirigir, crea el `ticket_orders` en `pending` guardando el `session_id` de Stripe.
   - `POST /api/stripe-webhook` → escucha el evento `checkout.session.completed`, marca el `ticket_orders` correspondiente como `paid` y (opcional) envía el email con la entrada/QR.
4. **Ajustes de base de datos** (una migración pequeña):
   - Añadir `stripe_session_id text` y `stripe_payment_intent text` a `ticket_orders`.
   - Mover el incremento de `quantity_sold` a cuando el pago pasa a `paid` (hoy sube al reservar). Idealmente hacerlo en una función `SECURITY DEFINER` que compruebe el aforo de forma atómica para no sobrevender.
5. **Front**: sustituir el botón "Reservar" de `src/pages/evento/components/EventTickets.tsx` por una llamada a `/api/checkout` y `window.location = url`. La confirmación real llega por el webhook, no por el cliente.

## Notas de seguridad

- El precio y el stock se validan **siempre en el servidor** con la `service_role key`, nunca fiándote del importe que mande el navegador.
- El webhook debe verificar la firma con `STRIPE_WEBHOOK_SECRET`.
- Para entradas gratis (`price_cents = 0`) puedes saltarte Stripe y confirmar la reserva directamente.

## Estado actual (sin Stripe)

Las tablas y políticas están en `supabase/migrations/0004_event_tickets.sql`. El flujo de reserva ya funciona end-to-end; solo falta interponer el pago entre "Reservar" y la confirmación.

# Acceso demo · RANKD (mientras no está lanzada)

La raíz `/` muestra **"Próximamente"** al público. Todo el contenido (Home,
Peleadores, Oportunidades, Marcas, Eventos, Noticias, Cómo funciona, Tienda…)
va cerrado tras `PublicGate` (`src/components/feature/PublicGate.tsx`).

## Cómo entrar a ver la app completa

1. Visita **una vez**:  `/vista-previa-rk28`
   Esa ruta no está enlazada en ningún sitio ni indexada (`robots.txt` → `Disallow: /`).
   Deja una marca en `localStorage` (`rk_preview_ok`) y redirige a la Home real.
2. A partir de ahí este navegador ve toda la web con normalidad.
3. Para llegar a las pantallas con login (Mi Esquina, dashboards, /club),
   haz **login** normal con una de las cuentas de abajo.

Para volver a cerrar la web en tu navegador: borra la clave `rk_preview_ok`
del `localStorage` (DevTools → Application → Local Storage).

## Cuentas demo (una por tipo de cuenta real)

Tipos reales hoy (comprobado en `src/pages/auth/page.tsx` → `MAIN_TYPES` /
`ORG_SUBTYPES` y `src/lib/supabase.ts` → `UserType`):
**fighter** (competidor · aficionado), **brand**, **promoter**, **gym**,
**manager**, **coach** (este último no se registra directo; en producción se
llega aceptando una invitación de gimnasio).

Contraseña de **todas**: `Rankd-demo-2026`

| Email | Tipo | Dónde vive su pantalla |
|---|---|---|
| `demo.fighter@rankd.test` | Fighter · competidor | `/mi-esquina` + `/dashboard/fighter` |
| `demo.hobby@rankd.test` | Fighter · aficionado (hobby) | `/mi-esquina` (variante hobby) |
| `demo.brand@rankd.test` | Marca | `/dashboard/brand` |
| `demo.promotora@rankd.test` | Promotora | `/dashboard/org` |
| `demo.gym@rankd.test` | Gimnasio | `/dashboard/org` + `/club` |
| `demo.manager@rankd.test` | Manager | `/dashboard/org` |
| `demo.coach@rankd.test` | Entrenador | `/club` |

## Crear / rellenar las cuentas

No están creadas por defecto. Ejecuta **una vez** (idempotente; re-ejecútalo
cuando quieras rellenar datos que falten):

```bash
node scripts/seed-demo-accounts.mjs
```

Necesita `.env` con `VITE_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
Los pasos sobre tablas de migraciones aún no aplicadas (`strength_sets`,
`activity_sessions`, `day_plan_items`, `gym_roster`…) se **saltan con aviso**,
no rompen el resto — aplica esas migraciones en Supabase si quieres esos datos.

## Instrucción para futuras sesiones de trabajo (Claude Code)

**Antes de dar por terminada cualquier tarea de rediseño o revisión visual:**

1. `preview_start` el dev server.
2. `navigate` a `/vista-previa-rk28` (abre el candado en el navegador del preview).
3. `navigate` a `/auth`, haz **login** con la cuenta demo del **tipo de cuenta
   correspondiente a la pantalla que has tocado** (tabla de arriba).
4. Navega hasta la pantalla afectada y **verifícala con captura real**
   (`computer` screenshot), no solo por lectura de código.
5. Si la tarea afecta a varios tipos de cuenta (p. ej. navegación global),
   repite con más de una cuenta.

Esto es lo que ha faltado en rondas anteriores y ha llevado a dar cambios por
hechos sin comprobarlos. El login de Supabase funciona en el navegador del
preview (no es como las capturas, que a veces fallan por no componer frame —
si el screenshot falla, verifica con `read_page` / `javascript_tool` sobre el
DOM real ya autenticado).

## ⚠️ Antes del lanzamiento público

- [ ] Borrar las 7 cuentas demo (`supabase` → Auth → Users, buscar `@rankd.test`)
      y sus filas en `profiles` / `fighters` / `organizations` / `brands`.
- [ ] Borrar `scripts/seed-demo-accounts.mjs` y este `ACCESO_DEMO.md`.
- [ ] Quitar `PublicGate` del router y la ruta `/vista-previa-rk28`
      (`src/router/config.tsx`), borrar `src/components/feature/PublicGate.tsx`
      y `src/pages/preview-entry/`. Decidir si `ComingSoonPage` se conserva.
- [ ] `public/robots.txt` → volver a reglas normales (ver historial de git).

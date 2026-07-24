# Sistema de correo de RANKD (Resend)

Todo el correo pasa por `api/email.js` (función serverless). **La clave de Resend nunca llega al navegador.**

## Estado: TODO CONSTRUIDO, esperando solo la clave

No queda código pendiente. En cuanto añadas `RESEND_API_KEY` empiezan a salir los correos de bienvenida, y con `SUPABASE_SERVICE_ROLE_KEY` se activa además el envío masivo.

**Mientras no haya clave no se rompe nada.** Una sonda `GET /api/email` (que **no gasta cuota**) detecta que falta y:
- El registro sigue funcionando igual, sin correo y sin error visible.
- El panel de admin muestra un aviso *"servicio de email no configurado todavía"* con las variables exactas que faltan. Puedes escribir y previsualizar el comunicado; solo se bloquea el envío.

---

## Qué necesitas hacer tú

### 1. Clave de Resend (obligatoria)

1. Entra en **https://resend.com** y crea una cuenta (el plan gratis da **100 correos/día y 3.000/mes**, de sobra para empezar).
2. Ve a **API Keys → Create API Key**, permiso *Sending access*. Copia la clave (`re_...`): solo se ve una vez.
3. En Vercel: **Settings → Environment Variables**
   - `RESEND_API_KEY` = `re_...`
   - Marca **Production** y **Preview**
4. **Redeploy** (sin redeploy la variable no entra).

En local, la misma línea en tu `.env` (ya está en `.gitignore`).

### 2. Remitente (recomendado)

Sin configurar nada, los correos salen desde `onboarding@resend.dev`. Funciona para probar, pero llega peor a la bandeja de entrada y no da imagen de marca.

Para usar tu dominio:
1. Resend → **Domains → Add Domain** → escribe tu dominio.
2. Resend te da unos registros **DNS** (SPF, DKIM y DMARC). Añádelos donde tengas el dominio.
3. Cuando Resend lo marque como *Verified*, añade en Vercel:
   - `RESEND_FROM` = `RANKD <hola@tudominio.com>`
4. Redeploy.

### 3. Clave de servicio de Supabase (solo para el envío masivo)

El envío masivo necesita leer los correos de los usuarios, que viven en `auth.users` y no son accesibles desde el navegador.

1. Supabase → **Project Settings → API → service_role** → copiar.
2. En Vercel: `SUPABASE_SERVICE_ROLE_KEY` = esa clave. **Production y Preview.**
3. Redeploy.

> ⚠️ Esta clave se salta todas las políticas de seguridad de la base de datos. Va **solo** en variables de entorno del servidor, nunca en el frontend ni en el repositorio.

### 4. Migración de base de datos (obligatoria)

Ejecuta `supabase/migrations/0008_notifications_and_email.sql` en **Supabase → SQL Editor → Run**.

Crea las notificaciones, el historial de comunicados y las incidencias de soporte. Es idempotente: se puede ejecutar más de una vez sin romper nada.

### Resumen de variables

| Variable | Dónde | Para qué | ¿Obligatoria? |
|---|---|---|---|
| `RESEND_API_KEY` | Vercel | Enviar cualquier correo | **Sí** |
| `RESEND_FROM` | Vercel | Remitente con tu dominio | Recomendada |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Envío masivo | Solo para comunicados |
| `SITE_URL` | Vercel | Enlaces dentro del correo | Solo con dominio propio |

---

## Qué envía cada cosa

### Correo de bienvenida

Se dispara solo al completar el registro, desde `src/pages/auth/page.tsx`. Va **sin esperar respuesta**: si el servicio tarda o falla, el registro no se queda colgado.

El texto **cambia según el tipo de cuenta** (peleador, promotora, gimnasio, manager, marca), cada uno con sus tres primeros pasos concretos. Nada de plantilla genérica.

### Comunicados desde el panel

**Panel de admin → Comunicados.**

- Eliges destinatarios: todos o filtrado por tipo de cuenta, con el número real de personas a las que va.
- Tres plantillas de partida para no empezar con el cuadro en blanco.
- **Vista previa fiel** mientras escribes.
- Botón **"Enviarme una prueba"**: te lo manda solo a ti para verlo en tu bandeja antes de disparar.
- Confirmación explícita con el número de destinatarios antes del envío definitivo.
- Historial de los últimos 10 envíos, reutilizables con un clic.

**Seguridad:** el endpoint no se fía de quien llama. Verifica el token de sesión contra Supabase en el servidor y comprueba que el correo esté en la lista de administradores (`ADMIN_EMAILS` en `api/email.js`). Llamar al endpoint desde fuera devuelve 403.

Los envíos van en lotes de 100 (endpoint *batch* de Resend), cada correo personalizado con el nombre de quien lo recibe.

---

## Diseño de los correos

Plantilla propia en `api/email.js`, construida con **tablas HTML y estilos en línea**: es la única forma de que se vea igual en Gmail, Outlook y Apple Mail, que no entienden flex ni grid ni cargan fuentes externas.

Incluye filo rojo superior, logotipo RANKD, antetítulo dorado, titular, cuerpo, botón de acción y pie con enlaces a las secciones. Fondo oscuro, coherente con la plataforma.

---

## Coste

El plan gratuito de Resend cubre **100 correos/día y 3.000/mes**. Referencias:

| Uso | Consumo |
|---|---|
| Correo de bienvenida | 1 correo por registro |
| Comunicado a 500 usuarios | 500 correos (supera el tope diario del plan gratis) |
| Sonda de disponibilidad | **0** (no llama a Resend) |

Si un comunicado va a superar el tope diario, Resend rechaza el exceso y el panel te dirá cuántos salieron de verdad. Para envíos grandes, el plan de pago empieza en unos $20/mes con 50.000 correos.

---

## Cómo comprobar que funciona

1. Añade `RESEND_API_KEY` en Vercel y haz redeploy.
2. Entra en **Panel de admin → Comunicados**. El aviso amarillo debe desaparecer y salir en verde el remitente que se va a usar.
3. Escribe un asunto y un mensaje y pulsa **"Enviarme una prueba"** → revisa tu bandeja (y la carpeta de spam si usas `onboarding@resend.dev`).
4. Regístrate con un correo nuevo → debe llegarte la bienvenida.
5. Para el envío masivo, añade también `SUPABASE_SERVICE_ROLE_KEY` y redeploy.

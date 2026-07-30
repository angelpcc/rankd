# Acceso con Google (Supabase OAuth)

La pantalla de `/auth` ya tiene el botón **"Continuar con Google"** tanto en
iniciar sesión como en crear cuenta. El código está completo: en cuanto
actives el proveedor en Supabase y en Google, funciona.

## Cómo funciona

1. El usuario pulsa **Continuar con Google** → `supabase.auth.signInWithOAuth`
   lo lleva a Google y vuelve a `/auth`.
2. Al volver, ya hay sesión:
   - Si su perfil **ya tiene tipo de cuenta**, va directo a su panel (o a Mi
     Esquina si es peleador por afición).
   - Si es **nuevo** (Google no trae tipo de cuenta), le pedimos que elija su
     tipo — peleador (compite / afición), organización o marca — y con eso se
     crea su perfil y pasa a su onboarding. El nombre se coge de Google.

No hay clave en el frontend: todo el flujo lo gestiona Supabase.

## Qué tienes que hacer tú (una vez)

1. **Google Cloud Console** → crea unas credenciales OAuth 2.0 (tipo *Web
   application*):
   - *Authorized JavaScript origins*: tu dominio (`https://rankd...vercel.app`)
     y `http://localhost:3000` para pruebas.
   - *Authorized redirect URI*: la que te da Supabase, con la forma
     `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
   - Apunta el **Client ID** y el **Client Secret**.
2. **Supabase Dashboard** → *Authentication* → *Providers* → **Google**:
   - Actívalo y pega el *Client ID* y el *Client Secret*.
3. **Supabase** → *Authentication* → *URL Configuration*:
   - *Site URL*: tu dominio de producción.
   - *Redirect URLs*: añade `https://<tu-dominio>/auth` y
     `http://localhost:3000/auth` (a donde volvemos tras el login).

## Comprobación

- Sin activar el proveedor, el botón muestra un aviso limpio
  ("No se pudo conectar con Google") y no rompe nada.
- Con el proveedor activo: pulsa el botón, entra con una cuenta de Google
  nueva → deberías ver el paso "Casi listo · elige tu tipo de cuenta" y, al
  elegir, acabar en el onboarding correspondiente.

> Nota: el correo de bienvenida se envía igual que en el registro normal
> (ver `EMAILS.md`); si el servicio de correo no está configurado, el registro
> no se queda esperando por él.

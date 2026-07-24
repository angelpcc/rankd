# Conectar las IAs de Mi Esquina (API de Claude)

Mi Esquina tiene **tres asistentes de IA especializados**, cada uno dentro de su sección y usando el **perfil físico del peleador** (disciplina, nivel, categoría, edad, peso actual y objetivo, récord) como contexto:

- **Coach IA (Entrenamiento)** → planifica sesiones y rutinas por disciplina y objetivo.
- **Coach de Nutrición** → planifica y ajusta la dieta; se apoya en el **diario de comidas** que el peleador va registrando.
- **Asesor de Material** → recomienda marcas y características según disciplina y nivel.

Los tres hablan con el mismo endpoint de backend: `api/coach.js` (función serverless), que llama a la API de Claude con el SDK oficial `@anthropic-ai/sdk`. **La clave nunca está en el frontend.**

## Lo que necesitas hacer tú (2 pasos)

### 1. Poner la clave de Anthropic como variable de entorno del backend

- Consigue una API key en https://console.anthropic.com → *API Keys*.
- En **Vercel**: proyecto → *Settings* → *Environment Variables* → añade:
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** tu clave (`sk-ant-...`)
  - Marca *Production* (y *Preview* si quieres probarlo en ramas). Redeploy.
- Para **desarrollo local**, añade la misma línea a tu archivo `.env` (ya está en `.gitignore`, no se sube):
  ```
  ANTHROPIC_API_KEY=sk-ant-tu-clave
  ```

Mientras no exista la clave, el endpoint responde `503` y el frontend muestra un aviso limpio ("IA a punto de entrar al ring") en vez de romperse. En cuanto la pongas, las tres IAs funcionan.

### 2. Ejecutar la migración del diario de comidas

En *Supabase → SQL Editor*, ejecuta:
```
supabase/migrations/0005_meal_log.sql
```
Crea la tabla `meal_entries` (con su RLS) para que el peleador registre comidas y la IA de nutrición pueda ajustar sobre esa base. Hasta que la ejecutes, el diario de comidas muestra un estado neutro y el resto de la sección funciona igual.

## Detalles técnicos

- **Modelo:** `claude-opus-4-8`.
- **Endpoint:** `POST /api/coach` con `{ section: 'training'|'nutrition'|'gear', profile, messages }`. El `system` prompt se construye por sección e inyecta el perfil físico.
- **Coste:** cada conversación son llamadas normales a la API de Claude (se factura por tokens en tu cuenta de Anthropic). El endpoint limita el historial a los últimos 20 turnos y 1500 tokens de salida para acotar coste y latencia.
- **Seguridad:** la key solo vive en `process.env.ANTHROPIC_API_KEY` del servidor; el navegador nunca la ve.

## Ideas para la siguiente ronda (no implementadas aún)

- **Guardar el plan de entreno de la IA directamente en el diario de entrenos** con un botón (requiere que la IA devuelva el plan en formato estructurado; se puede hacer con *structured outputs* de la API).
- **Streaming** de las respuestas (aparecen palabra a palabra) para una sensación más viva.
- **Memoria entre sesiones** por peleador, para que la IA recuerde conversaciones anteriores.

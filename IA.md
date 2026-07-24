# Las IAs de Mi Esquina (API de Claude)

Mi Esquina tiene **tres asistentes de IA especializados**, cada uno dentro de su sección y usando el **perfil físico del peleador** como contexto:

- **Coach de Entrenamiento** → planifica sesiones y rutinas por disciplina y objetivo.
- **Coach de Nutrición** → planifica y ajusta la dieta; se apoya en el diario de comidas.
- **Asesor de Material** → recomienda marcas y características según disciplina y nivel.

Los tres hablan con `api/coach.js` (función serverless) usando el SDK oficial `@anthropic-ai/sdk`. **La clave nunca está en el frontend.**

---

## Estado: TODO CONSTRUIDO, esperando solo la clave

No queda código pendiente. En cuanto añadas `ANTHROPIC_API_KEY` las tres IAs funcionan, con streaming y guardado de plan incluidos.

Mientras no haya clave: una sonda `GET /api/coach` (que **no gasta API**) detecta que no está configurada y las secciones muestran un estado *"Muy pronto"* cuidado. **No se rompe nada ni se ve ningún error.**

### ✅ Streaming de respuestas
La respuesta aparece **token a token**, como si escribiera, en vez de saltar de golpe. Implementado con SSE: el backend usa `anthropic.messages.stream()` y emite `data: {delta}`; el front lo lee con `response.body.getReader()` y va reescribiendo el último mensaje, con un cursor parpadeante mientras llega.

### ✅ Guardado automático del plan en el diario
Cuando la IA propone un plan, aparece un botón **"Guardar este plan en mi diario"**:
- **Entrenamiento** → inserta las sesiones en `training_sessions` (diario de entrenos), con tipo, duración, intensidad y notas.
- **Nutrición** → inserta las comidas en `meal_entries` (diario de comidas).

Por debajo hace una segunda llamada con **structured outputs** (`output_config.format` + JSON Schema), que obliga al modelo a devolver el plan en un formato exacto y validado. Así no dependemos de "parsear texto a ojo". Si la conversación no contiene un plan concreto, avisa en vez de inventarse nada.

---

## Coste estimado por conversación

Modelo `claude-opus-4-8`: **$5 por millón de tokens de entrada** y **$25 por millón de salida**.

Cada mensaje reenvía el historial (limitado a los últimos 20 turnos), así que el coste crece según se alarga la conversación. Estimaciones para una **conversación típica de 6 idas y vueltas**:

| Asistente | Entrada aprox. | Salida aprox. | **Coste por conversación** |
|---|---|---|---|
| **Entrenamiento** (planes largos) | ~15.000 tok | ~5.400 tok | **≈ $0,21** |
| **Nutrición** (menús, ajustes) | ~14.500 tok | ~4.800 tok | **≈ $0,19** |
| **Material** (respuestas más cortas) | ~13.000 tok | ~3.000 tok | **≈ $0,14** |

Otras referencias:
- **Consulta corta** (1-2 mensajes): **≈ $0,03–0,05**
- **Guardar un plan** (la llamada extra de extracción): **≈ $0,03**
- **Sonda de disponibilidad**: **$0** (no llama al modelo)

**Traducido a volumen:** con ~$10/mes te salen unas **50 conversaciones completas** o unas 200 consultas cortas. Los topes ya están puestos para acotar: `max_tokens` de salida a 1.500 y el historial a 20 turnos.

> **Nota:** el *prompt caching* abarataría la entrada, pero **aquí no aplica**: el prefijo cacheable mínimo en Opus 4.8 es de 4.096 tokens y nuestro system prompt ronda los 400. Si algún día el contexto crece mucho, merecerá la pena revisarlo.

---

## Qué necesitas hacer tú (cuando quieras activarlo)

1. **Clave**: consíguela en https://console.anthropic.com → *API Keys*. En Vercel: *Settings* → *Environment Variables* → `ANTHROPIC_API_KEY` = `sk-ant-...` (Production y Preview) → Redeploy. En local, la misma línea en tu `.env` (ya está en `.gitignore`).
2. **Migración del diario de comidas** (sigue pendiente): ejecuta `supabase/migrations/0005_meal_log.sql` en *Supabase → SQL Editor*. Sin ella, el guardado de planes de **nutrición** no tiene dónde escribir (el de entrenamiento sí funciona, usa una tabla que ya existe).

---

## Perfil físico: qué se le envía a la IA

Se arma automáticamente desde tus datos y se inyecta en el *system prompt* de las tres IAs:

| Dato | De dónde sale |
|---|---|
| Nombre | `profiles.full_name` |
| Disciplina, nivel, categoría de peso, edad | tabla `fighters` |
| Récord (V-D-E, KOs) | tabla `fighters` |
| **Peso actual** | último registro de `weight_entries` |
| **Peso objetivo** | `nutrition_goals.target_weight_kg` |
| Objetivo declarado | `fighters.looking_for` |
| Volumen de entreno de la semana | `training_sessions` |

### ⚠️ La altura no se guarda en ningún sitio
Mencionaste la altura como parte del perfil físico, pero **no existe ninguna columna de altura** en la base de datos, así que hoy no se le puede enviar. El código ya la contempla (`heightCm`): en cuanto exista el campo, se envía sola. Para tenerla haría falta una migración pequeña (`fighters.height_cm`) más el campo en el formulario de perfil — dime y lo añado.

### Cómo verificarlo cuando conectes la clave
1. Entra en Mi Esquina → **Nutrición**, registra tu peso y ponte un peso objetivo.
2. Ve a **Coach IA** y pregunta *"¿cómo voy de peso para mi categoría?"*. Debe citar **tus cifras reales**, no genéricas.
3. Pide *"plan de esta semana"* y pulsa **Guardar este plan en mi diario** → comprueba que las sesiones aparecen en el diario de entrenos.
4. En **Material**, pregunta *"¿qué guantes me compro?"*: debe ajustar la respuesta a tu disciplina y nivel (no es lo mismo un principiante de Muay Thai que un profesional de MMA).

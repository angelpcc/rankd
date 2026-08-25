# RANKD · Principios del Design System

Estos 15 principios rigen cualquier decisión visual en RANKD. Si un
diseño los rompe, se rediseña. Si un componente los ignora, no entra en
producción.

---

## 1. Profundidad, no acumulación

Más elementos no es mejor UX. Menos elementos con más presencia sí.
Antes de añadir una tarjeta, pregúntate si otra existente puede
absorberla.

## 2. Un feature por pantalla

Cada pantalla tiene **un** elemento con tratamiento visual dominante
(Card variant="feature", h1 con presencia real, KPI grande). El resto
son default o quiet.

## 3. Máximo un glow por viewport

Los glows (`--rk-glow-red`, `--rk-glow-gold`) son signature moments. Si
todo brilla, nada brilla. Un glow por lo que se ve en pantalla — no
más.

## 4. Superficies sólidas primero

`--rk-surface-raised: #101010` sólido es el default de las cards.
Translucidez y blur solo cuando hay algo visualmente detrás que
difuminar (navbar sobre hero, sheet sobre página).

## 5. Los gradientes son intencionales

Un gradiente rojo→gold es una firma. Diez gradientes sutiles son ruido.
Reservar para: botón primario en Hero, borde de card feature, filos de
sección.

## 6. La interfaz respira

Espaciado generoso (mínimo `--rk-space-6` entre bloques). Si dos cosas
están pegadas, no relacionadas. Si están separadas, autónomas.

## 7. Jerarquía de importancia visible

Tres niveles: **feature** (dominante), **default** (la mayoría),
**quiet** (metadata, timestamps, secundarios). Elegir uno por elemento,
sin ambigüedad.

## 8. Nada de decoración por defecto

Elementos flotantes, iconos gigantes, patrones ambientales sin
propósito narrativo — fuera. Si no comunica algo, no está.

## 9. Animaciones sutiles y funcionales

Las animaciones señalan cambios de estado o entrada de contenido. No
son un efecto. Duraciones cortas (`--rk-dur-fast` a `--rk-dur-base`),
easing `--rk-ease-out`. Nada de spring/bounce en botones ni glow
pulsante permanente.

## 10. Tocar es tan importante como ver

Todo objetivo táctil mínimo `--rk-touch-min` (44px). Nada de botones
diminutos por estética.

## 11. Móvil no es "desktop responsive"

En cada pantalla, decidir qué se ve en mobile y cómo antes de pensar
en desktop. La app es PWA — la mayoría de peleadores la usarán con el
pulgar en el autobús.

## 12. Color por función, no por decoración

Los colores del sistema son: negro, rojo #E10600, oro #C9A84C. El
verde/ámbar/rojo semánticos existen SOLO para estado (éxito, warning,
error). Nada de "otro color guay porque queda bien".

## 13. Editorial vs App: dos comportamientos

`--rk-fs-editorial-*` (Bebas gigante con clamp) SOLO en landing, hero
de perfil público, cartelera. `--rk-fs-title-*` (tamaños sobrios) para
todo lo demás (Mi Esquina, dashboards, formularios).

## 14. Consistencia sobre creatividad puntual

Si algo ya existe como componente (Button, Card, Input), usarlo — no
reinventar. Pequeñas creatividades locales rompen la sensación de
sistema.

## 15. La marca vive en los detalles, no en la saturación

Un filo rojo en el header, un contador dorado en un KPI, un flash de
PR — más marca que 20 gradientes decorativos.

---

## Cómo aplicar en la práctica

- Cada componente del DS tiene comentarios explicando **cuándo usar
  cada variante** y **por qué existe**. Léelos antes de crear una
  variante nueva.
- Si necesitas una variante que no existe, pregúntate si es una
  necesidad real o si estás inventando. En caso de duda, no la crees.
- Si un token nuevo tiene sentido para toda la app, va en
  `tokens.css`. Si es local a una pantalla, no lo hagas token.
- Todo texto nuevo pasa por i18n. Sin excepciones.

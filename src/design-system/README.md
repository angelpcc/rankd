# RANKD · Design System

Sistema de diseño canónico de RANKD. Todos los componentes visuales
deben salir de aquí. Cualquier reimplementación local (botones a
mano, cards inline, inputs con estilo propio) se considera deuda.

## Arquitectura

```
src/design-system/
  tokens.css              Única fuente de verdad de variables CSS.
  principles.md           Los 15 principios que rigen el sistema.
  README.md               Este archivo.
  components/
    Button.tsx            Acciones. 4 variantes × 3 tamaños.
    Card.tsx              Superficie base. 3 variantes.
    Input.tsx             Entrada de texto/número/textarea.
    Badge.tsx             Etiquetas semánticas.
    EmptyState.tsx        Vista sin datos.
    StateBanner.tsx       Aviso contextual compacto.
    Modal.tsx             Overlay desktop / bottom sheet mobile.
    Sheet.tsx             Bottom sheet dedicado.
    SnapshotCard.tsx      Dato clave (KPI + acción).
    Hub.tsx               Sección con tabs internas.
    SectionHeader.tsx     Encabezado de sección estandarizado.
    DirectoryLayout.tsx   Layout para listados públicos con filtros.
    index.ts              Re-export.
```

## Uso

```tsx
import { Button, Card, EmptyState } from '@/design-system';

<Card variant="feature" padding="lg">
  <h2>Mi contenido</h2>
  <Button variant="primary" size="md" onClick={onSave}>Guardar</Button>
</Card>
```

## Convivencia con el sistema legacy

Durante la migración de pantallas, los componentes viejos
(`.rk-btn`, `.rk-card`, `.rk-cta`, `.rk-nav-btn`, `.card-primary`)
siguen funcionando. Los pintados a mano también. El design system
NO borra nada del legacy — reemplaza cuando cada pantalla se
migra.

Cuando una pantalla se migre:
1. Importar componentes de `@/design-system`.
2. Retirar clases legacy y estilos inline.
3. Comprobar visualmente en desktop y mobile.
4. Ejecutar build y type-check.

## Catálogo visual

En `/design-system` (solo admin) se puede ver el sistema entero
renderizado con todas sus variantes. Es la referencia para asegurar
que no se rompe nada al iterar sobre un componente.

## Añadir un componente nuevo

Solo si:
- No existe uno que resuelva el mismo problema con ligera adaptación.
- Se va a usar en ≥3 pantallas distintas.
- Tiene variantes claras y limitadas.

Debe:
- Tipar con TypeScript, sin `any`.
- Consumir tokens de `tokens.css`.
- Documentar cada variante con un comentario que explique cuándo usarla.
- Renderizar en `/design-system` para catálogo visual.
- Ser accesible (roles ARIA, focus-visible con `.rk-ds-focus-ring`).

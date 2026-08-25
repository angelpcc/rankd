// RANKD · Design System — barrel de re-exportación.
// Permite `import { Button, Card } from '@/design-system'` en vez de rutas
// sueltas por componente. Ver README.md para el catálogo completo y
// principles.md para las reglas de uso.
//
// Nota: el README describe también SnapshotCard, Hub, SectionHeader y
// DirectoryLayout — todavía no existen. Se añaden aquí en cuanto se creen.

export { default as Button } from './components/Button';
export type { ButtonProps } from './components/Button';

export { default as Card } from './components/Card';
export type { CardProps } from './components/Card';

export { default as Input } from './components/Input';
export type { InputProps } from './components/Input';

export { default as Badge } from './components/Badge';
export type { BadgeProps } from './components/Badge';

export { default as EmptyState } from './components/EmptyState';

export { default as StateBanner } from './components/StateBanner';

export { default as Modal } from './components/Modal';

export { default as Sheet } from './components/Sheet';

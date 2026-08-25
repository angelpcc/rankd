import BottomSheet from '@/components/base/BottomSheet';
import type { ReactNode } from 'react';

/**
 * Sheet · bottom sheet dedicado.
 *
 * Cuando quieras sheet EN TODAS las pantallas (móvil y desktop): flujos
 * largos, wizards, formularios densos donde un diálogo centrado se
 * quedaría pequeño en desktop. Es el patrón que ya usa
 * StrengthSessionForm.
 *
 * Si lo que quieres es "diálogo centrado en desktop, sheet en mobile",
 * usa Modal — automáticamente lo hace.
 *
 * Se apoya en BottomSheet (src/components/base/BottomSheet.tsx) que ya
 * existía y funciona; el DS lo re-expone con el mismo nombre para que
 * las pantallas nuevas importen todo desde `@/design-system`.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Sheet({ open, onClose, title, children, footer }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} footer={footer}>
      {children}
    </BottomSheet>
  );
}

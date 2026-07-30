import { useEffect, useRef, useState, ReactNode } from 'react';

type Variant = 'up' | 'scale' | 'left';

interface Props {
  children: ReactNode;
  /** Retardo en milisegundos para entradas escalonadas */
  delay?: number;
  variant?: Variant;
  className?: string;
  /** Si es true, se reproduce cada vez que entra en pantalla */
  repeat?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}

const VARIANT_CLASS: Record<Variant, string> = {
  up: 'rk-reveal',
  scale: 'rk-reveal-scale',
  left: 'rk-reveal-left',
};

/**
 * Envuelve cualquier contenido para que aparezca con suavidad
 * cuando entra en el área visible. Cero dependencias externas.
 */
export default function Reveal({
  children,
  delay = 0,
  variant = 'up',
  className = '',
  repeat = false,
  as: Tag = 'div',
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Si el usuario prefiere menos movimiento, mostramos directamente
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (!repeat) observer.unobserve(entry.target);
        } else if (repeat) {
          setVisible(false);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [repeat]);

  return (
    <Tag
      ref={ref as React.RefObject<never>}
      className={`${VARIANT_CLASS[variant]} ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
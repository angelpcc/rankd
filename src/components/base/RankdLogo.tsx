interface Props {
  /** Alto del icono en px (el wordmark escala con él) */
  size?: number;
  /** Muestra el texto RANKD junto al icono */
  showWordmark?: boolean;
  className?: string;
}

/**
 * Marca oficial de RANKD: icono + wordmark.
 * El icono vive en /public (mismo archivo que usa el PWA), así que
 * cambiarlo ahí lo actualiza en toda la app.
 */
export default function RankdLogo({ size = 30, showWordmark = true, className = '' }: Props) {
  const fontSize = Math.round(size * 0.86);
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: showWordmark ? 9 : 0 }}>
      <img
        src="/icon-192.png"
        alt="RANKD"
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), display: 'block', flexShrink: 0 }}
      />
      {showWordmark && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, lineHeight: 1 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize, color: '#ffffff', letterSpacing: 3, lineHeight: 1 }}>RAN</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize, color: '#E10600', letterSpacing: 3, lineHeight: 1 }}>KD</span>
        </span>
      )}
    </span>
  );
}

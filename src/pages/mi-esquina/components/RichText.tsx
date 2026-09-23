import { Fragment, type ReactNode } from 'react';
import { trocearTablas, type TablaMd } from '../lib/sessionTable';

// ════════════════════════════════════════════════════════════════
// El texto de la IA, bien pintado. Lo comparten el Asesor y el chat del plan.
//
// Antes cada chat tenía su versión: el Asesor entendía negritas y listas, y
// el del plan ni eso (texto tal cual, con los asteriscos a la vista). Y
// ninguno entendía TABLAS, que es justo como se lee una sesión: una tabla de
// Hyrox salía como una ristra de barras verticales imposible de seguir.
//
// Entiende: tablas markdown, títulos (#, ##, ###), separadores (---), listas
// numeradas y con viñetas, citas (>), **negritas**, [VIDEO: nombre] y enlaces
// [texto](https://…).
// ════════════════════════════════════════════════════════════════

// Dos marcadores conviven en el texto de la IA:
//  - [VIDEO: nombre]        → botón a búsqueda de YouTube. Búsqueda y no una
//    URL concreta para que el enlace SIEMPRE sea válido.
//  - [texto](https://...)   → enlace real (asesor de Material). Solo http/https
//    para no colar esquemas raros.
const INLINE_RE = /\[VIDEO:\s*([^\]]+)\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;

function youtubeSearch(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim() + ' técnica tutorial')}`;
}

// Negritas (**texto**) dentro de un fragmento.
function renderBold(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
    seg.startsWith('**') && seg.endsWith('**') && seg.length > 4
      ? <strong key={`${keyBase}-b${j}`} className="text-white font-semibold">{seg.slice(2, -2)}</strong>
      : <span key={`${keyBase}-s${j}`}>{seg}</span>
  );
}

// Una línea: negritas + [VIDEO: …] y [texto](url) como botones pinchables.
function renderInline(text: string, keyBase: string, watchLabel: string) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderBold(text.slice(last, m.index), `${keyBase}-t${idx}`));
    if (m[1] !== undefined) {
      const q = m[1].trim();
      nodes.push(
        <a key={`${keyBase}-v${idx}`} href={youtubeSearch(q)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 align-middle mx-0.5 my-0.5 rounded-lg bg-red-600/12 border border-red-500/35 text-red-300 hover:bg-red-600/20 hover:text-red-200 transition-colors px-2 py-0.5 text-xs font-semibold no-underline">
          <i className="ri-play-circle-fill"></i>{watchLabel} {q}
        </a>
      );
    } else {
      nodes.push(
        <a key={`${keyBase}-lnk${idx}`} href={m[3].trim()} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 align-middle mx-0.5 my-0.5 rounded-lg bg-white/[0.06] border border-white/15 text-sky-300 hover:text-sky-200 hover:border-white/30 transition-colors px-2 py-0.5 text-xs font-semibold no-underline">
          <i className="ri-external-link-line"></i>{m[2].trim()}
        </a>
      );
    }
    last = m.index + m[0].length;
    idx++;
  }
  if (last < text.length) nodes.push(...renderBold(text.slice(last), `${keyBase}-t${idx}`));
  return nodes;
}

/**
 * Una tabla de verdad, con su cabecera y sus filas.
 *
 * Con scroll lateral propio: en el móvil una tabla de cuatro columnas no cabe,
 * y es mejor deslizar la tabla que aplastar el texto de cada celda hasta que
 * "Kettlebell swings" ocupe cuatro líneas.
 */
function Tabla({ tabla, k, watchLabel }: { tabla: TablaMd; k: string; watchLabel: string }) {
  const cols = Math.max(tabla.cabecera.length, ...tabla.filas.map((f) => f.length));
  return (
    <div className="rk-md-table my-2.5">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, c) => (
              <th key={c}>{renderInline(tabla.cabecera[c] || '', `${k}-h${c}`, watchLabel)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((f, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}>{renderInline(f[c] || '', `${k}-${r}-${c}`, watchLabel)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderLineas(lineas: string[], keyBase: string, watchLabel: string) {
  return lineas.map((line, n) => {
    const i = `${keyBase}-${n}`;
    const trimmed = line.trim();

    // Títulos. El ### sale como etiqueta pequeña de color: es como el modelo
    // separa "Calentamiento" de "Bloque principal", y un rótulo se busca de
    // un vistazo mejor que otra línea en negrita.
    const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const nivel = h[1].length;
      return nivel <= 2
        ? <p key={i} className="text-[16px] font-bold text-white tracking-tight mt-3 mb-0.5">{renderInline(h[2].replace(/\*\*/g, ''), i, watchLabel)}</p>
        : <p key={i} className="rk-label mt-3 mb-0.5" style={{ color: 'var(--accent-2, #C4B5FD)', fontSize: 11 }}>{h[2].replace(/\*\*/g, '')}</p>;
    }

    // Separador.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      return <div key={i} className="my-3" style={{ height: 1, background: 'var(--line)' }} />;
    }

    // Cita / nota destacada.
    const cita = trimmed.match(/^>\s?(.*)$/);
    if (cita) {
      return (
        <div key={i} className="my-1.5 pl-3 py-1 text-[14px]" style={{ borderLeft: '2px solid rgba(167,139,250,0.55)', color: 'var(--t-2)' }}>
          {renderInline(cita[1], i, watchLabel)}
        </div>
      );
    }

    // Lista numerada ("1. …", "2) …"): el número en su chapa se cuenta de un
    // vistazo, que es para lo que está numerado.
    const num = trimmed.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (num) {
      return (
        <div key={i} className="flex gap-2.5 items-start mt-1.5">
          <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold text-white mt-0.5"
            style={{ background: 'rgba(225,6,0,0.22)' }}>{num[1]}</span>
          <span className="min-w-0">{renderInline(num[2], i, watchLabel)}</span>
        </div>
      );
    }

    const bullet = /^[-*•]\s+/.test(trimmed);
    if (bullet) {
      // Sangría de las sublistas: dos espacios o más delante.
      const sub = /^\s{2,}/.test(line);
      return (
        <div key={i} className={`flex gap-2 ${sub ? 'pl-5' : 'pl-1'}`}>
          <span className="flex-shrink-0 mt-[9px] rounded-full"
            style={{ width: sub ? 3 : 4, height: sub ? 3 : 4, background: 'var(--accent)', opacity: sub ? 0.45 : 0.7 }} />
          <span className="min-w-0">{renderInline(trimmed.replace(/^[-*•]\s+/, ''), i, watchLabel)}</span>
        </div>
      );
    }
    if (trimmed === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{renderInline(line, i, watchLabel)}</div>;
  });
}

export default function RichText({ text, watchLabel }: { text: string; watchLabel: string }) {
  const trozos = trocearTablas(text);
  return (
    <>
      {trozos.map((tr, n) => (tr.tipo === 'tabla'
        ? <Tabla key={`t${n}`} tabla={tr.tabla} k={`t${n}`} watchLabel={watchLabel} />
        : <Fragment key={`p${n}`}>{renderLineas(tr.lineas, `p${n}`, watchLabel)}</Fragment>))}
    </>
  );
}

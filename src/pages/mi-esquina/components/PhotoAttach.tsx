// ════════════════════════════════════════════════════════════════
// RANKD · Adjuntar una foto O UN PDF a un mensaje del chat
//
// Un botón y una miniatura. Está aquí y no dentro de cada chat porque los dos
// —Consulta y Plan— hacen exactamente lo mismo con ella, y la parte delicada
// (reducir la foto antes de mandarla) no debe acabar copiada en dos sitios.
//
// ── UN SOLO BOTÓN, NO DOS ──
//
// No hay "hacer foto", "galería" y "archivo" por separado: un input de fichero
// en un móvil ya abre el menú del sistema con las tres. Poner tres botones es
// repetir en la app una decisión que el teléfono presenta mejor, y ocupa sitio
// en una barra que en un móvil va justa.
//
// ── EL PDF NO SE TOCA ──
//
// Las fotos se encogen antes de salir; un PDF viaja entero. En un PDF el texto
// y las columnas de la tabla llegan tal cual, y eso es justo lo que se manda
// por aquí: la hoja del plan, la tabla de la cinta. Convertirlo en imagen sería
// volver a la foto de un papel, que es de donde veníamos.
// ════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACEPTA_DOCUMENTO, MAX_ADJUNTO_BYTES, mbDe, prepararImagen, type ImagenLista } from '@/lib/imageInput';

interface Props {
  /** La foto elegida, ya reducida. null si no hay ninguna. */
  foto: ImagenLista | null;
  onFoto: (f: ImagenLista | null) => void;
  disabled?: boolean;
  /** Para contar por qué no se ha podido adjuntar. Sin esto fallaba en silencio. */
  onError?: (msg: string) => void;
}

/** El botón. La miniatura se pinta aparte (ver `FotoPendiente`). */
export default function PhotoAttach({ foto, onFoto, disabled, onError }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);

  const elegir = async (file: File | undefined) => {
    if (!file) return;

    // Se comprueba ANTES de leerlo.
    //
    // Un PDF viaja entero y Vercel corta la petición por tamaño antes de que
    // la IA llegue a existir, así que dejarte adjuntar algo más grande es
    // dejarte mandar un mensaje que no puede salir nunca. Y fallaba sin
    // decir por qué: el aviso ponía literalmente "error".
    //
    // Solo afecta a los PDF en la práctica: las fotos se encogen luego y
    // nunca se acercan al tope, así que el aviso menciona la salida buena,
    // que es hacerle una foto a la hoja.
    if (file.size > MAX_ADJUNTO_BYTES) {
      onError?.(t('mc_chat_file_too_big', { max: mbDe(MAX_ADJUNTO_BYTES), tam: mbDe(file.size) }));
      if (ref.current) ref.current.value = '';
      return;
    }

    setLeyendo(true);
    const img = await prepararImagen(file);
    setLeyendo(false);
    if (img) onFoto(img);
    else onError?.(t('mc_chat_file_failed'));
    // El input se vacía siempre: si no, elegir la MISMA foto dos veces seguidas
    // no dispara el change y parece que la app ha ignorado el toque.
    if (ref.current) ref.current.value = '';
  };

  return (
    <>
      <input ref={ref} type="file" accept={ACEPTA_DOCUMENTO} className="hidden"
        onChange={(e) => void elegir(e.target.files?.[0])} />
      <button type="button" onClick={() => ref.current?.click()}
        disabled={disabled || leyendo}
        title={t('mc_chat_photo')}
        aria-label={t('mc_chat_photo')}
        className={`w-10 h-10 flex-shrink-0 rounded-xl border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${foto ? 'border-white/30 bg-white/[0.07] text-white' : 'border-white/12 bg-white/[0.03] text-zinc-300 hover:text-white hover:border-white/25'}`}>
        {leyendo
          ? <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          : <i className={foto?.esPdf ? 'ri-file-pdf-line text-lg' : 'ri-attachment-2 text-lg'} />}
      </button>
    </>
  );
}

/**
 * La miniatura de la foto que está esperando a mandarse.
 *
 * Va encima de la caja de escribir y no dentro del botón: tiene que verse lo
 * que vas a mandar ANTES de mandarlo. Sin esto, con la foto equivocada te
 * enteras cuando ya la ha leído y ya la has pagado.
 */
export function FotoPendiente({ foto, onQuitar }: { foto: ImagenLista; onQuitar: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5 mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
      {/* Un PDF no tiene miniatura: se enseña su icono y su nombre, que es
          lo que de verdad identifica CUÁL has adjuntado. */}
      {foto.esPdf ? (
        <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: 'rgba(225,6,0,0.12)', color: 'var(--accent)' }}>
          <i className="ri-file-pdf-line text-xl" />
        </div>
      ) : (
        <img src={foto.previewUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate">{foto.nombre || t(foto.esPdf ? 'mc_chat_doc_ready' : 'mc_chat_photo_ready')}</p>
        <p className="text-[10px] text-zinc-500">{Math.round(foto.bytes / 1024)} KB</p>
      </div>
      <button type="button" onClick={onQuitar}
        aria-label={t('mc_chat_photo_remove')}
        className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

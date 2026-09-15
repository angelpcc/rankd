// ════════════════════════════════════════════════════════════════
// RANKD · Adjuntar una foto a un mensaje del chat
//
// Un botón y una miniatura. Está aquí y no dentro de cada chat porque los dos
// —Consulta y Plan— hacen exactamente lo mismo con ella, y la parte delicada
// (reducir la foto antes de mandarla) no debe acabar copiada en dos sitios.
//
// ── UN SOLO BOTÓN, NO DOS ──
//
// No hay "hacer foto" y "elegir de la galería" por separado: un `<input
// type="file" accept="image/*">` en un móvil ya abre el menú del sistema con
// la cámara y la galería. Poner dos botones es repetir en la app una decisión
// que el teléfono ya presenta mejor, y ocupa sitio en una barra que en un móvil
// va justa.
// ════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { prepararImagen, type ImagenLista } from '@/lib/imageInput';

interface Props {
  /** La foto elegida, ya reducida. null si no hay ninguna. */
  foto: ImagenLista | null;
  onFoto: (f: ImagenLista | null) => void;
  disabled?: boolean;
}

/** El botón. La miniatura se pinta aparte (ver `FotoPendiente`). */
export default function PhotoAttach({ foto, onFoto, disabled }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);

  const elegir = async (file: File | undefined) => {
    if (!file) return;
    setLeyendo(true);
    const img = await prepararImagen(file);
    setLeyendo(false);
    if (img) onFoto(img);
    // El input se vacía siempre: si no, elegir la MISMA foto dos veces seguidas
    // no dispara el change y parece que la app ha ignorado el toque.
    if (ref.current) ref.current.value = '';
  };

  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => void elegir(e.target.files?.[0])} />
      <button type="button" onClick={() => ref.current?.click()}
        disabled={disabled || leyendo}
        title={t('mc_chat_photo')}
        aria-label={t('mc_chat_photo')}
        className={`w-10 h-10 flex-shrink-0 rounded-xl border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${foto ? 'border-white/30 bg-white/[0.07] text-white' : 'border-white/12 bg-white/[0.03] text-zinc-300 hover:text-white hover:border-white/25'}`}>
        {leyendo
          ? <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          : <i className="ri-image-add-line text-lg" />}
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
      <img src={foto.previewUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white">{t('mc_chat_photo_ready')}</p>
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

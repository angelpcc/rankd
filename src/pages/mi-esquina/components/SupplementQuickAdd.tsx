// ════════════════════════════════════════════════════════════════
// RANKD · Un batido, con los números de verdad
//
// ── EL PROBLEMA ──
//
// Un batido de proteína era lo más frecuente del diario y lo peor resuelto:
// escribías "batido de proteína" y se guardaba como texto, sin un solo macro.
// Para un plato tiene sentido estimar; para un bote NO, porque los números
// están impresos en la etiqueta. Estimar cuando puedes leer es tirar precisión.
//
// ── CÓMO FUNCIONA ──
//
// La primera vez: foto de la tabla nutricional → se leen los valores POR
// DOSIS. La segunda vez y todas las siguientes: tu bote ya está ahí, dices
// cuántos cacitos y listo. Sin IA, sin foto y sin escribir nada.
//
// Y todo es editable a mano: hay botes con la tabla borrada y gente que se
// sabe sus números. Obligar a la foto sería cambiar un trabajo por otro.
// ════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACEPTA_DOCUMENTO, MAX_ADJUNTO_BYTES, mbDe, prepararImagen } from '@/lib/imageInput';
import {
  cargarProductos, guardarProducto, leerEtiqueta, olvidarProducto,
  type MacrosDosis, type ProductoGuardado,
} from '@/services/labelReader';

interface Props {
  profileId: string;
  /** Texto de partida (lo que ya había escrito), para no perderlo. */
  inicial?: string;
  onAdd: (description: string, macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const VACIO: MacrosDosis = { calorias: 0, proteina: 0, carbohidratos: 0, grasas: 0 };
const r1 = (x: number) => Math.round(x * 10) / 10;

export default function SupplementQuickAdd({ profileId, inicial, onAdd, onClose, showToast }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [guardados, setGuardados] = useState<ProductoGuardado[]>(() => cargarProductos(profileId));
  const [producto, setProducto] = useState(inicial?.trim() || '');
  const [dosisG, setDosisG] = useState(30);
  const [macros, setMacros] = useState<MacrosDosis>(VACIO);
  // Medias dosis existen: mucha gente se echa un cacito y medio.
  const [dosis, setDosis] = useState(1);
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const usar = (p: ProductoGuardado) => {
    setProducto(p.producto);
    setDosisG(p.dosisG);
    setMacros(p.porDosis);
    setAviso(null);
  };

  const elegirFoto = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_ADJUNTO_BYTES) {
      showToast(t('mc_chat_file_too_big', { max: mbDe(MAX_ADJUNTO_BYTES), tam: mbDe(file.size) }), 'error');
      return;
    }
    setLeyendo(true);
    setAviso(null);
    const img = await prepararImagen(file);
    if (!img) { setLeyendo(false); showToast(t('mc_chat_file_failed'), 'error'); return; }
    const { etiqueta, error } = await leerEtiqueta(img.base64, img.mediaType);
    setLeyendo(false);
    if (fileRef.current) fileRef.current.value = '';
    if (!etiqueta) { showToast(error === 'sin_etiqueta' ? t('mc_bat_no_label') : (error || t('mc_bat_read_fail')), 'error'); return; }
    setProducto(etiqueta.producto);
    setDosisG(etiqueta.dosisG);
    setMacros(etiqueta.porDosis);
    // El aviso se enseña tal cual: si ha tenido que calcular la dosis desde
    // los 100 g o la foto salía borrosa, el usuario tiene derecho a saberlo
    // ANTES de que esos números entren en su diario.
    setAviso(!etiqueta.leido ? t('mc_bat_estimated') : etiqueta.aviso);
  };

  const total = {
    calories: Math.round(macros.calorias * dosis),
    protein_g: r1(macros.proteina * dosis),
    carbs_g: r1(macros.carbohidratos * dosis),
    fat_g: r1(macros.grasas * dosis),
  };
  const hayNumeros = macros.calorias > 0 || macros.proteina > 0;

  const anadir = () => {
    const nombre = producto.trim() || t('mc_bat_default_name');
    if (hayNumeros) {
      guardarProducto(profileId, { producto: nombre, dosisG, porDosis: macros });
      setGuardados(cargarProductos(profileId));
    }
    // La descripción dice las dosis Y los gramos: dentro de un mes, "2 cacitos"
    // no significa nada si has cambiado de bote; "2 cacitos (60 g)" sí.
    const desc = dosis === 1
      ? `${nombre} (1 ${t('mc_bat_scoop')}, ${r1(dosisG)} g)`
      : `${nombre} (${dosis} ${t('mc_bat_scoops')}, ${r1(dosisG * dosis)} g)`;
    onAdd(desc, total);
  };

  const campo = (k: keyof MacrosDosis, etiqueta: string, sufijo: string) => (
    <label className="flex-1 min-w-0">
      <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{etiqueta}</span>
      <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg px-2">
        <input
          type="number" inputMode="decimal" min={0} value={macros[k] || ''}
          onChange={(e) => setMacros((m) => ({ ...m, [k]: Math.max(0, Number(e.target.value) || 0) }))}
          className="w-full bg-transparent text-white text-sm py-2 focus:outline-none"
          style={{ fontSize: 16 }} />
        <span className="text-[10px] text-zinc-500 flex-shrink-0">{sufijo}</span>
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative rk-card w-full sm:max-w-md max-h-[90vh] overflow-y-auto" style={{ padding: 0 }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="rk-h3" style={{ fontSize: '1.02rem', color: '#fff' }}>{t('mc_bat_title')}</h3>
          <button onClick={onClose} aria-label={t('mc_close')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tus botes. Un toque y ya están los números: es el caso de todos
              los días, y tiene que costar menos que el de la primera vez. */}
          {guardados.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">{t('mc_bat_yours')}</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {guardados.map((p) => (
                  <div key={p.producto}
                    className="flex-shrink-0 flex items-stretch bg-green-500/10 border border-green-500/25 rounded-full overflow-hidden hover:border-green-500/50 transition-colors">
                    <button onClick={() => usar(p)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 hover:bg-green-500/15 pl-3.5 pr-2.5 py-2 cursor-pointer transition-colors whitespace-nowrap">
                      <i className="ri-flask-line text-xs text-green-400" />
                      <span className="max-w-[150px] truncate">{p.producto}</span>
                      <span className="text-[10px] text-zinc-400">{Math.round(p.porDosis.proteina)}g P</span>
                    </button>
                    <button onClick={() => { olvidarProducto(profileId, p.producto); setGuardados(cargarProductos(profileId)); }}
                      aria-label={t('mc_delete')}
                      className="flex items-center justify-center px-3 border-l border-green-500/25 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors">
                      <i className="ri-close-line text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* La foto de la etiqueta: el camino exacto. */}
          <input ref={fileRef} type="file" accept={ACEPTA_DOCUMENTO} hidden
            onChange={(e) => void elegirFoto(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={leyendo}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-sm font-semibold text-zinc-200 hover:border-white/40 hover:text-white py-3 cursor-pointer disabled:opacity-60 transition-colors">
            {leyendo
              ? <><div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />{t('mc_bat_reading')}</>
              : <><i className="ri-camera-lens-line text-base" />{t('mc_bat_read_label')}</>}
          </button>

          {aviso && (
            <p className="text-[11px] leading-snug flex items-start gap-1.5" style={{ color: 'var(--t-2)' }}>
              <i className="ri-information-line mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <span>{aviso}</span>
            </p>
          )}

          <div>
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{t('mc_bat_product')}</span>
            <input value={producto} onChange={(e) => setProducto(e.target.value)}
              placeholder={t('mc_bat_product_ph')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-green-500"
              style={{ fontSize: 16 }} />
          </div>

          <div>
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('mc_bat_per_scoop', { g: r1(dosisG) })}</span>
            <div className="flex gap-2">
              {campo('calorias', t('mc_bat_kcal'), '')}
              {campo('proteina', t('mc_bat_prot'), 'g')}
              {campo('carbohidratos', t('mc_bat_carb'), 'g')}
              {campo('grasas', t('mc_bat_fat'), 'g')}
            </div>
            <label className="flex items-center gap-2 mt-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{t('mc_bat_scoop_size')}</span>
              <input type="number" inputMode="decimal" min={1} value={dosisG || ''}
                onChange={(e) => setDosisG(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none"
                style={{ fontSize: 16 }} />
              <span className="text-[10px] text-zinc-500">g</span>
            </label>
          </div>

          {/* Cuántos te has tomado. Medias dosis incluidas: mucha gente se echa
              cacito y medio y redondear a uno o dos falsea el día entero. */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">{t('mc_bat_how_many')}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setDosis((d) => Math.max(0.5, r1(d - 0.5)))} aria-label="-"
                className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 text-white flex items-center justify-center cursor-pointer hover:border-white/30">
                <i className="ri-subtract-line" />
              </button>
              <span className="w-12 text-center text-lg font-bold text-white">{dosis}</span>
              <button onClick={() => setDosis((d) => Math.min(10, r1(d + 0.5)))} aria-label="+"
                className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 text-white flex items-center justify-center cursor-pointer hover:border-white/30">
                <i className="ri-add-line" />
              </button>
            </div>
          </div>

          {/* Lo que va a entrar en el diario, antes de que entre. */}
          <div className="rounded-xl border border-green-500/25 bg-green-500/[0.07] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-lg font-bold text-white">{total.calories} <span className="text-xs font-semibold text-zinc-400">kcal</span></span>
              <div className="flex gap-2.5 text-[11px] font-semibold">
                <span className="text-sky-300">{total.protein_g}g P</span>
                <span className="text-amber-300">{total.carbs_g}g C</span>
                <span className="text-rose-300">{total.fat_g}g G</span>
              </div>
            </div>
          </div>

          <button onClick={anadir} disabled={!hayNumeros}
            className="rk-cta rk-press w-full flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ minHeight: 48 }}>
            <i className="ri-add-line text-lg" /> {t('mc_bat_add')}
          </button>
          {!hayNumeros && (
            <p className="text-[11px] text-zinc-500 text-center leading-snug">{t('mc_bat_need_numbers')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

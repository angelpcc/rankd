import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/base/BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Vuelca el total calculado al campo de peso y cierra. */
  onUse: (totalKg: number) => void;
}

const BAR_OPTIONS = [20, 15, 10];
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Calculadora de discos para ejercicios de barra: eliges la barra y vas
 * sumando discos POR LADO. Muestra el total y el desglose. Es solo una ayuda
 * de cálculo — no guarda los discos, solo el peso final que devuelve `onUse`.
 */
export default function PlateCalculator({ open, onClose, onUse }: Props) {
  const { t } = useTranslation();
  const [bar, setBar] = useState<number>(20);
  const [customBar, setCustomBar] = useState('');
  const [perSide, setPerSide] = useState<number[]>([]);

  const barKg = bar === -1 ? (parseFloat(customBar.replace(',', '.')) || 0) : bar;
  const sideKg = perSide.reduce((a, p) => a + p, 0);
  const total = +(barKg + sideKg * 2).toFixed(2);

  const grouped = useMemo(() => {
    const m = new Map<number, number>();
    perSide.forEach((p) => m.set(p, (m.get(p) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [perSide]);

  const addPlate = (p: number) => setPerSide((prev) => [...prev, p].sort((a, b) => b - a));
  const removeOne = (p: number) => setPerSide((prev) => {
    const i = prev.indexOf(p);
    if (i === -1) return prev;
    const next = [...prev]; next.splice(i, 1); return next;
  });
  const reset = () => { setPerSide([]); };

  const breakdown = grouped.length > 0
    ? `${t('mc_plc_bar')} ${barKg} + (${grouped.map(([p, n]) => (n > 1 ? `${p}×${n}` : `${p}`)).join(' + ')}) × 2`
    : `${t('mc_plc_bar')} ${barKg}`;

  return (
    <BottomSheet open={open} onClose={onClose} title={t('mc_plc_title')}
      footer={
        <button onClick={() => { onUse(total); onClose(); }} disabled={total <= 0}
          className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ fontSize: '0.95rem', minHeight: 44 }}>
          <i className="ri-check-line"></i> {t('mc_plc_use', { n: total })}
        </button>
      }>
      <div className="space-y-5">
        {/* Barra */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">{t('mc_plc_bar_label')}</label>
          <div className="flex flex-wrap gap-1.5">
            {BAR_OPTIONS.map((b) => (
              <button key={b} onClick={() => setBar(b)}
                className={`px-3.5 rounded-xl border text-sm font-bold cursor-pointer transition-all ${bar === b ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}
                style={{ minHeight: 44 }}>
                {b} kg
              </button>
            ))}
            <button onClick={() => setBar(-1)}
              className={`px-3.5 rounded-xl border text-sm font-bold cursor-pointer transition-all ${bar === -1 ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}
              style={{ minHeight: 44 }}>
              {t('mc_plc_bar_other')}
            </button>
            {bar === -1 && (
              <input value={customBar} onChange={(e) => setCustomBar(e.target.value)} inputMode="decimal" placeholder="kg"
                style={{ fontSize: 16, minHeight: 44, width: 90 }}
                className="bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-red-500" />
            )}
          </div>
        </div>

        {/* Discos por lado */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2">{t('mc_plc_plates_label')}</label>
          <div className="grid grid-cols-4 gap-1.5">
            {PLATES.map((p) => (
              <button key={p} onClick={() => addPlate(p)}
                className="py-2.5 rounded-xl border border-white/12 bg-white/[0.03] text-white text-sm font-bold hover:border-white/30 cursor-pointer transition-all"
                style={{ minHeight: 44 }}>
                +{p}
              </button>
            ))}
          </div>
        </div>

        {/* Lo añadido */}
        {grouped.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{t('mc_plc_per_side')}</p>
              <button onClick={reset} className="text-[11px] text-zinc-500 hover:text-white cursor-pointer">{t('mc_plc_clear')}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {grouped.map(([p, n]) => (
                <button key={p} onClick={() => removeOne(p)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-200 bg-white/[0.05] border border-white/10 px-2.5 py-1.5 rounded-lg cursor-pointer hover:border-red-500/40 hover:text-red-300 transition-colors">
                  {p} kg{n > 1 ? ` ×${n}` : ''} <i className="ri-close-line text-[11px]"></i>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="text-center py-2">
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, lineHeight: 1, color: '#fff' }}>
            {t('mc_plc_total')} {total} kg
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">{breakdown}</p>
        </div>
      </div>
    </BottomSheet>
  );
}

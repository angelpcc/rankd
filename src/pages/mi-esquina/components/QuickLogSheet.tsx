// ════════════════════════════════════════════════════════════════
// RANKD · Registro rápido
//
// ── EL PROBLEMA ──
//
// Apuntar algo exigía saber DÓNDE se apunta: el peso en Peso, el agua dentro de
// Nutrición en la pestaña Agua, la comida en el diario, el cardio en Actividad.
// Quien entra solo a dejar constancia de lo que ha hecho tenía que recorrer el
// menú, y cada viaje de más es un registro que no se hace.
//
// ── LA SOLUCIÓN ──
//
// Un solo botón, siempre a mano (en el menú del ordenador y flotando en el
// móvil), que abre esto:
//
//   · Peso y agua, AQUÍ MISMO: son un número y un toque, no merecen un viaje.
//   · "¿Cómo estás hoy?": energía, agujetas y sueño. El asesor lo lee para
//     ajustar la carga y hasta ahora nadie podía escribirlo (el componente
//     existía y no se mostraba en ninguna pantalla).
//   · Comida, foto del plato, fuerza, cardio y boxeo: llevan directos a su
//     pantalla de registro, no a la portada de la sección.
// ════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@/lib/supabase';
import BottomSheet from '@/components/base/BottomSheet';
import DailyCheckin from './DailyCheckin';
import { SECTION_COLOR, tinte } from '../lib/sectionTheme';
import { guardarPesoHoy, leerAgua, leerPeso, sumarAgua } from '../lib/quickLog';

export type QuickDestino =
  | { s: 'nutricion'; tab: 'diario' | 'foto' }
  | { s: 'fuerza' }
  | { s: 'actividad' }
  | { s: 'timer' };

interface Props {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Lleva a la pantalla de registro de lo elegido. */
  onGo: (d: QuickDestino) => void;
  /** Algo se ha guardado desde aquí: el Resumen tiene que releer. */
  onLogged: () => void;
}

export default function QuickLogSheet({ open, onClose, profile, showToast, onGo, onLogged }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [peso, setPeso] = useState('');
  const [ultimo, setUltimo] = useState<number | null>(null);
  const [deHoy, setDeHoy] = useState(false);
  const [guardandoPeso, setGuardandoPeso] = useState(false);
  const [agua, setAgua] = useState<number | null>(null);
  const [checkin, setCheckin] = useState(false);

  // Se lee al abrir: lo de hoy puede haber cambiado desde otra pantalla.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPeso(''); setCheckin(false);
    leerPeso(profile.id).then((p) => { if (alive) { setUltimo(p.ultimo); setDeHoy(p.deHoy); } }).catch(() => {});
    leerAgua(profile.id).then((ml) => { if (alive) setAgua(ml); }).catch(() => {});
    return () => { alive = false; };
  }, [open, profile.id]);

  const guardarPeso = async () => {
    const kg = parseFloat(peso.replace(',', '.'));
    if (!kg) return;
    setGuardandoPeso(true);
    const ok = await guardarPesoHoy(profile.id, kg);
    setGuardandoPeso(false);
    if (!ok) { showToast(t('error_save'), 'error'); return; }
    const d = ultimo != null && !deHoy ? +(kg - ultimo).toFixed(1) : 0;
    showToast(d
      ? t('mc_ql_weight_saved_delta', { n: kg, d: `${d > 0 ? '+' : ''}${d}` })
      : t('mc_ql_weight_saved', { n: kg }));
    setUltimo(kg); setDeHoy(true); setPeso('');
    onLogged();
  };

  const beber = async (ml: number) => {
    const antes = agua;
    setAgua((a) => (a ?? 0) + ml); // al momento; si falla, vuelve
    const total = await sumarAgua(profile.id, ml);
    if (total == null) { setAgua(antes); showToast(t('error_save'), 'error'); return; }
    setAgua(total);
    onLogged();
  };

  const ir = (d: QuickDestino) => { onClose(); onGo(d); };

  const tile = (color: string, icon: string, titulo: string, sub: string, onClick: () => void) => (
    <button onClick={onClick} className="rk-quick-tile rk-press">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
        style={{ background: tinte(color, 0.14), color }}>
        <i className={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white leading-tight">{titulo}</span>
        <span className="block text-xs mt-0.5 leading-snug" style={{ color: 'var(--t-3)' }}>{sub}</span>
      </span>
    </button>
  );

  const hoyTxt = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <BottomSheet open={open} onClose={onClose} title={t('mc_ql_title')}>
      <p className="text-xs mb-4 first-letter:uppercase" style={{ color: 'var(--t-3)' }}>{hoyTxt}</p>

      {checkin ? (
        <div className="space-y-3">
          <button onClick={() => setCheckin(false)} className="text-xs inline-flex items-center gap-1.5 cursor-pointer hover:text-white" style={{ color: 'var(--t-2)' }}>
            <i className="ri-arrow-left-line" />{t('mc_ql_back')}
          </button>
          <DailyCheckin profile={profile} showToast={(m, ty) => { showToast(m, ty); if (ty !== 'error') onLogged(); }} />
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── Peso, aquí mismo ── */}
          <div className="rounded-2xl p-3.5" style={{ background: tinte(SECTION_COLOR.peso, 0.07), border: `1px solid ${tinte(SECTION_COLOR.peso, 0.22)}` }}>
            <div className="flex items-center gap-2 mb-2.5">
              <i className="ri-scales-2-line" style={{ color: SECTION_COLOR.peso }} />
              <p className="text-sm font-semibold text-white">{t('mc_ql_weight')}</p>
              <span className="ml-auto text-xs" style={{ color: 'var(--t-3)' }}>
                {ultimo != null ? t(deHoy ? 'mc_ql_weight_today' : 'mc_ql_weight_last', { n: ultimo }) : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <input value={peso} onChange={(e) => setPeso(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5))}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarPeso(); }}
                  inputMode="decimal" aria-label={t('mc_ql_weight')}
                  placeholder={ultimo != null ? String(ultimo) : '75.0'}
                  className="w-full bg-black/30 border border-white/10 text-white rounded-xl pl-3.5 pr-10 focus:outline-none focus:border-white/30"
                  style={{ fontSize: 16, minHeight: 46 }} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--t-3)' }}>kg</span>
              </div>
              <button onClick={guardarPeso} disabled={!peso || guardandoPeso}
                className="rk-cta rk-press disabled:opacity-40" style={{ minHeight: 46, padding: '0 1.1rem', fontSize: 14 }}>
                {guardandoPeso ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('mc_save')}
              </button>
            </div>
          </div>

          {/* ── Agua, un toque ── */}
          <div className="rounded-2xl p-3.5 flex items-center gap-2" style={{ background: tinte(SECTION_COLOR.nutricion, 0.06), border: `1px solid ${tinte(SECTION_COLOR.nutricion, 0.2)}` }}>
            <i className="ri-drop-line text-lg flex-shrink-0" style={{ color: SECTION_COLOR.nutricion }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{t('mc_ql_water')}</p>
              <p className="text-xs" style={{ color: 'var(--t-3)' }}>
                {agua == null ? '…' : t('mc_ql_water_today', { n: (agua / 1000).toLocaleString(locale, { maximumFractionDigits: 2 }) })}
              </p>
            </div>
            {[250, 500].map((ml) => (
              <button key={ml} onClick={() => beber(ml)}
                className="rk-nav-btn rk-press text-sm flex-shrink-0 whitespace-nowrap" style={{ minHeight: 42, padding: '0 0.7rem' }}>
                +{ml} ml
              </button>
            ))}
          </div>

          {/* ── A su pantalla ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {tile(SECTION_COLOR.nutricion, 'ri-restaurant-line', t('mc_ql_meal'), t('mc_ql_meal_sub'), () => ir({ s: 'nutricion', tab: 'diario' }))}
            {tile(SECTION_COLOR.nutricion, 'ri-camera-lens-line', t('mc_ql_photo'), t('mc_ql_photo_sub'), () => ir({ s: 'nutricion', tab: 'foto' }))}
            {tile(SECTION_COLOR.fuerza, 'ri-hammer-line', t('mc_ql_strength'), t('mc_ql_strength_sub'), () => ir({ s: 'fuerza' }))}
            {tile(SECTION_COLOR.actividad, 'ri-run-line', t('mc_ql_cardio'), t('mc_ql_cardio_sub'), () => ir({ s: 'actividad' }))}
            {tile(SECTION_COLOR.ring, 'ri-timer-flash-line', t('mc_ql_boxing'), t('mc_ql_boxing_sub'), () => ir({ s: 'timer' }))}
            {tile(SECTION_COLOR.asesor, 'ri-emotion-line', t('mc_ql_checkin'), t('mc_ql_checkin_sub'), () => setCheckin(true))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

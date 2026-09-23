import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PhysicalProfileForm from './PhysicalProfileForm';
import { guardarKcalManual, KCAL_MAX, KCAL_MIN, type DailyTarget } from '../lib/objetivoDiario';

// El objetivo diario de calorías y macros, con su explicación y su ajuste.
//
// ── POR QUÉ LLEVA EL "¿DE DÓNDE SALE?" ──
//
// Una cifra de calorías sin explicación es una cifra que no te crees: 2.350,
// ¿por qué no 2.000? Aquí se dice en dos líneas qué datos se han usado (peso,
// altura, edad, sexo y cuántos días entrenas), qué se ha quitado o sumado por
// tu objetivo de peso y cómo salen las macros. Plegado, para no ocupar la
// pantalla a quien ya se lo cree.
//
// ── Y POR QUÉ SE PUEDE CAMBIAR ──
//
// Quien tiene nutricionista ya tiene su número. Lo pone aquí, y a partir de ahí
// la app entera (anillos, resumen, plan de comidas y las IAs) cuadra con el
// suyo. Se vuelve al cálculo con un botón.

interface Props {
  profileId: string;
  target: DailyTarget;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Tras guardar a mano o completar el perfil: hay que volver a calcular. */
  onChanged: () => void;
}

const fmt = (n: number, locale: string) => Math.round(n).toLocaleString(locale);

export default function ObjetivoDiarioCard({ profileId, target, showToast, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);

  const dirKey = target.direction === 'bajar' ? 'mc_mp_dir_down'
    : target.direction === 'subir' ? 'mc_mp_dir_up' : 'mc_mp_dir_keep';

  const guardar = async (kcal: number | null) => {
    if (kcal != null && (!Number.isFinite(kcal) || kcal < KCAL_MIN || kcal > KCAL_MAX)) {
      showToast(t('mc_obj_out_of_range', { min: fmt(KCAL_MIN, locale), max: fmt(KCAL_MAX, locale) }), 'error');
      return;
    }
    setGuardando(true);
    const r = await guardarKcalManual(profileId, kcal);
    setGuardando(false);
    if (!r.ok) { showToast(t('error_save'), 'error'); return; }
    showToast(t(kcal == null ? 'mc_obj_reset_done' : r.soloEsteDispositivo ? 'mc_obj_saved_local' : 'mc_obj_saved'));
    setEditando(false);
    onChanged();
  };

  const dias = target.trainingDays == null
    ? t('mc_obj_days_none')
    : t(target.trainingDaysFrom === 'registro' ? 'mc_obj_days_real' : 'mc_obj_days_profile', { count: target.trainingDays });

  const macro = (v: number, k: string) => (
    <div className="rounded-xl px-2 py-2.5 text-center" style={{ background: 'var(--s-2)' }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1, color: 'var(--t-1)' }}>{v}g</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1 truncate">{t(k)}</p>
    </div>
  );

  return (
    <div className="rk-card" style={{ padding: 18 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="rk-label">{t('mc_obj_title')}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
          style={{ background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
          {t(dirKey)}
        </span>
        {target.manual && (
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
            style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)', color: 'var(--t-2)' }}>
            {t('mc_obj_manual_chip')}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 mt-3">
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 1, color: '#fff' }}>
          {fmt(target.kcal, locale)}
          <span className="text-sm text-zinc-500 ml-1.5">{t('mc_obj_kcal_day')}</span>
        </p>
        <button onClick={() => { setValor(String(target.kcal)); setEditando((v) => !v); }}
          className="rk-nav-btn rk-press text-xs inline-flex items-center gap-1.5 flex-shrink-0"
          style={{ minHeight: 40, padding: '0 0.9rem' }} aria-expanded={editando}>
          <i className="ri-equalizer-line" />{t('mc_obj_adjust')}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {macro(target.protein, 'mc_mp_short_protein')}
        {macro(target.carbs, 'mc_mp_short_carbs')}
        {macro(target.fat, 'mc_mp_short_fat')}
      </div>

      {/* Ajustar a mano */}
      {editando && (
        <div className="mt-3 rounded-xl p-3 anim-scale-in" style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
          <label className="block text-xs text-zinc-400 mb-1.5" htmlFor="rk-obj-kcal">{t('mc_obj_input_label')}</label>
          <div className="flex gap-2">
            <input id="rk-obj-kcal" value={valor} inputMode="numeric"
              onChange={(e) => setValor(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              onKeyDown={(e) => { if (e.key === 'Enter') guardar(Number(valor)); }}
              className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 focus:outline-none focus:border-red-500"
              style={{ fontSize: 16, minHeight: 44 }} />
            <button onClick={() => guardar(Number(valor))} disabled={guardando || !valor}
              className="rk-cta rk-press disabled:opacity-50" style={{ minHeight: 44, padding: '0 1.2rem', fontSize: '0.85rem' }}>
              {t('mc_save')}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">{t('mc_obj_input_hint')}</p>
          {target.manual && (
            <button onClick={() => guardar(null)} disabled={guardando}
              className="text-xs mt-2 inline-flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors disabled:opacity-50"
              style={{ color: 'var(--t-2)' }}>
              <i className="ri-refresh-line" />{t('mc_obj_reset', { n: fmt(target.calculatedKcal ?? target.kcal, locale) })}
            </button>
          )}
        </div>
      )}

      {/* Sin los cuatro datos no es un cálculo tuyo: se dice y se ofrece arreglarlo. */}
      {!target.personalised && !target.manual && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)' }}>
          <i className="ri-error-warning-line text-[#C9A84C] flex-shrink-0" />
          <p className="text-[11px] text-zinc-300 flex-1 min-w-[160px] leading-relaxed">{t('mc_mp_not_personal')}</p>
          <button onClick={() => setPerfilAbierto(true)} className="rk-nav-btn text-[11px]" style={{ padding: '0.4rem 0.8rem', minHeight: 40 }}>
            {t('mc_mp_complete_profile')}
          </button>
        </div>
      )}

      {target.aggressive && (
        <p className="mt-3 text-[11px] text-orange-300/90 flex items-start gap-1.5 leading-relaxed">
          <i className="ri-alert-line mt-0.5 flex-shrink-0" />{t('mc_mp_aggressive')}
        </p>
      )}

      {/* ¿De dónde sale? */}
      <button onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}
        className="mt-3 text-xs inline-flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
        style={{ color: 'var(--t-3)' }}>
        <i className={abierto ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />{t('mc_obj_why')}
      </button>
      {abierto && (
        <div className="mt-2 space-y-1.5 text-xs leading-relaxed anim-scale-in" style={{ color: 'var(--t-2)' }}>
          {target.manual ? (
            <p>{t('mc_obj_manual_explain', { n: fmt(target.calculatedKcal ?? target.kcal, locale) })}</p>
          ) : target.personalised ? (
            <>
              <p>{t('mc_obj_explain_base', { m: fmt(target.maintenance, locale), dias })}</p>
              <p>{t(`mc_obj_explain_dir_${target.direction}`)}</p>
            </>
          ) : null}
          <p>{t('mc_obj_explain_macros')}</p>
        </div>
      )}

      <PhysicalProfileForm open={perfilAbierto} onClose={() => setPerfilAbierto(false)}
        profileId={profileId} showToast={showToast}
        onSaved={() => { setPerfilAbierto(false); onChanged(); }} />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/base/BottomSheet';
import {
  loadPhysical, savePhysical, emptyPhysical, ageFromBirth,
  type FighterPhysical,
} from '@/lib/physicalProfile';

// Formulario del perfil físico (Bloque A.2). Todos los campos son OPCIONALES;
// nada bloquea. Se abre desde la card de completitud (Resumen) y desde Ajustes.

interface Props {
  open: boolean;
  onClose: () => void;
  profileId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Se llama tras guardar, con el perfil actualizado (para refrescar la card). */
  onSaved?: (p: FighterPhysical) => void;
  /**
   * Qué hacer después de guardar. Rellenar el perfil sin más no lleva a
   * ninguna parte: en cuanto hay datos, lo lógico es montar un plan. Se ofrece
   * hacerlo a mano o dejárselo al Asesor.
   */
  onGoPlanificar?: () => void;
  onGoAsesor?: () => void;
}

const SEX_OPTS = ['male', 'female', 'other'] as const;
const SPORT_OPTS = ['boxeo', 'mma', 'kickboxing', 'muaythai', 'otro'] as const;
const LEVEL_OPTS = ['principiante', 'amateur', 'competidor', 'profesional'] as const;
const EQUIP_OPTS = ['gimnasio_completo', 'gimnasio_basico', 'casa_material', 'casa_sin_material'] as const;

function num(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function PhysicalProfileForm({ open, onClose, profileId, showToast, onSaved, onGoPlanificar, onGoAsesor }: Props) {
  const { t } = useTranslation();
  const [p, setP] = useState<FighterPhysical>(emptyPhysical());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Tras guardar se muestra el "¿y ahora qué?" en la misma hoja, en vez de
  // cerrarla y dejar al usuario donde estaba sin saber qué hacer con esos datos.
  const [donePrompt, setDonePrompt] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setDonePrompt(false);
    loadPhysical(profileId).then(({ data }) => { if (alive) { setP(data); setLoading(false); } });
    return () => { alive = false; };
  }, [open, profileId]);

  const set = <K extends keyof FighterPhysical>(k: K, v: FighterPhysical[K]) => setP((prev) => ({ ...prev, [k]: v }));

  // Con esto ya se puede montar un plan con sentido. Sin ello, ofrecerlo sería
  // ruido: el Asesor no tendría con qué trabajar.
  const enoughToPlan = p.training_days_per_week != null && (p.level != null || p.sport != null);

  const save = async () => {
    setSaving(true);
    const ok = await savePhysical(profileId, p);
    setSaving(false);
    if (!ok) { showToast(t('error_save'), 'error'); return; }
    showToast(t('mc_pp_saved'));
    onSaved?.(p);
    // Solo se ofrece el siguiente paso si hay a dónde ir y datos suficientes.
    if (enoughToPlan && (onGoPlanificar || onGoAsesor)) { setDonePrompt(true); return; }
    onClose();
  };

  const age = ageFromBirth(p.birth_date);

  const inputCls = 'w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500';
  const labelCls = 'block text-xs text-zinc-400 mb-1.5';

  // Selector de opciones como chips (más táctil que un <select> en móvil).
  const chips = <T extends string>(value: T | null, opts: readonly T[], onPick: (v: T | null) => void, keyPrefix: string) => (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <button key={o} type="button" onClick={() => onPick(value === o ? null : o)} style={{ minHeight: 44 }}
          className={`px-3.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${value === o ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
          {t(`${keyPrefix}${o}`)}
        </button>
      ))}
    </div>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={donePrompt ? t('mc_pp_done_title') : t('mc_pp_title')}
      footer={donePrompt ? (
        <button onClick={onClose} style={{ minHeight: 48 }}
          className="rk-nav-btn w-full flex items-center justify-center gap-2">
          {t('mc_pp_done_later')}
        </button>
      ) : (
        <button onClick={save} disabled={saving || loading} style={{ minHeight: 48 }}
          className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
            : <><i className="ri-save-line"></i> {t('mc_pp_save')}</>}
        </button>
      )}
    >
      {donePrompt ? (
        <div className="space-y-4">
          <div className="text-center py-2">
            <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}>
              <i className="ri-check-line text-2xl" style={{ color: '#4ade80' }} />
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed max-w-xs mx-auto">
              {t('mc_pp_done_desc', { n: p.training_days_per_week ?? 0 })}
            </p>
          </div>
          {onGoAsesor && (
            <button onClick={() => { onClose(); onGoAsesor(); }} style={{ minHeight: 60 }}
              className="w-full text-left rounded-xl border border-red-500/40 bg-red-600/[0.10] px-4 cursor-pointer hover:border-red-500/70 transition-colors">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <i className="ri-compass-3-line text-red-400" />{t('mc_pp_done_advisor')}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-3)' }}>{t('mc_pp_done_advisor_sub')}</p>
            </button>
          )}
          {onGoPlanificar && (
            <button onClick={() => { onClose(); onGoPlanificar(); }} style={{ minHeight: 60 }}
              className="w-full text-left rounded-xl border border-white/12 bg-white/[0.03] px-4 cursor-pointer hover:border-white/30 transition-colors">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <i className="ri-calendar-todo-line" style={{ color: 'var(--t-2)' }} />{t('mc_pp_done_self')}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-3)' }}>{t('mc_pp_done_self_sub')}</p>
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-zinc-500 leading-relaxed flex items-start gap-1.5">
            <i className="ri-shield-user-line mt-0.5 flex-shrink-0"></i>{t('mc_pp_intro')}
          </p>

          {/* Peso + altura */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('mc_pp_weight')}</label>
              <input value={p.weight_kg ?? ''} inputMode="decimal" placeholder="0" style={{ fontSize: 16, minHeight: 44 }}
                onChange={(e) => set('weight_kg', num(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('mc_pp_height')}</label>
              <input value={p.height_cm ?? ''} inputMode="numeric" placeholder="0" style={{ fontSize: 16, minHeight: 44 }}
                onChange={(e) => set('height_cm', num(e.target.value))} className={inputCls} />
            </div>
          </div>

          {/* Fecha de nacimiento */}
          <div>
            <label className={labelCls}>{t('mc_pp_birth')}{age !== null && <span className="text-zinc-500 font-normal"> · {t('mc_pp_age', { n: age })}</span>}</label>
            <input type="date" value={p.birth_date ?? ''} max={new Date().toISOString().slice(0, 10)} style={{ fontSize: 16, minHeight: 44 }}
              onChange={(e) => set('birth_date', e.target.value || null)} className={`${inputCls} cursor-pointer`} />
          </div>

          {/* Sexo */}
          <div>
            <label className={labelCls}>{t('mc_pp_sex')}</label>
            {chips(p.sex, SEX_OPTS, (v) => set('sex', v), 'mc_pp_sex_')}
          </div>

          {/* Deporte */}
          <div>
            <label className={labelCls}>{t('mc_pp_sport')}</label>
            {chips(p.sport, SPORT_OPTS, (v) => set('sport', v), 'mc_pp_sport_')}
          </div>

          {/* Nivel */}
          <div>
            <label className={labelCls}>{t('mc_pp_level')}</label>
            {chips(p.level, LEVEL_OPTS, (v) => set('level', v), 'mc_pp_level_')}
          </div>

          {/* Días entrenables: pastillas del 1 al 7. Era un campo numérico
              libre, y poner "5" o "6" obligaba a abrir el teclado para un dato
              que solo tiene siete valores posibles. */}
          <div>
            <label className={labelCls}>{t('mc_pp_days')}</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                const active = p.training_days_per_week === n;
                return (
                  <button key={n} type="button" style={{ minHeight: 44, minWidth: 44 }}
                    onClick={() => set('training_days_per_week', active ? null : n)}
                    className={`rounded-xl text-sm font-bold border transition-all cursor-pointer ${active ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minutos por sesión: valores habituales de un toque, y campo libre
              debajo para cualquier otro. */}
          <div>
            <label className={labelCls}>{t('mc_pp_minutes')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {[30, 45, 60, 75, 90, 120].map((n) => {
                const active = p.session_minutes === n;
                return (
                  <button key={n} type="button" style={{ minHeight: 44 }}
                    onClick={() => set('session_minutes', active ? null : n)}
                    className={`px-3.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${active ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'}`}>
                    {n}′
                  </button>
                );
              })}
            </div>
            <input value={p.session_minutes ?? ''} inputMode="numeric" placeholder={t('mc_pp_minutes_other')}
              style={{ fontSize: 16, minHeight: 44 }}
              onChange={(e) => set('session_minutes', num(e.target.value))} className={inputCls} />
          </div>

          {/* Material */}
          <div>
            <label className={labelCls}>{t('mc_pp_equipment')}</label>
            {chips(p.equipment_access, EQUIP_OPTS, (v) => set('equipment_access', v), 'mc_pp_eq_')}
          </div>

          {/* Lesiones */}
          <div>
            <label className={labelCls}>{t('mc_pp_injuries')}</label>
            <textarea value={p.injuries_notes ?? ''} rows={2} maxLength={300} placeholder={t('mc_pp_injuries_ph')} style={{ fontSize: 16 }}
              onChange={(e) => set('injuries_notes', e.target.value || null)} className={`${inputCls} resize-none`} />
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

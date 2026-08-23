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
}

const SEX_OPTS = ['male', 'female', 'other'] as const;
const SPORT_OPTS = ['boxeo', 'mma', 'kickboxing', 'muaythai', 'otro'] as const;
const LEVEL_OPTS = ['principiante', 'amateur', 'competidor', 'profesional'] as const;
const EQUIP_OPTS = ['gimnasio_completo', 'gimnasio_basico', 'casa_material', 'casa_sin_material'] as const;

function num(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function PhysicalProfileForm({ open, onClose, profileId, showToast, onSaved }: Props) {
  const { t } = useTranslation();
  const [p, setP] = useState<FighterPhysical>(emptyPhysical());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    loadPhysical(profileId).then(({ data }) => { if (alive) { setP(data); setLoading(false); } });
    return () => { alive = false; };
  }, [open, profileId]);

  const set = <K extends keyof FighterPhysical>(k: K, v: FighterPhysical[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    const ok = await savePhysical(profileId, p);
    setSaving(false);
    if (!ok) { showToast(t('error_save'), 'error'); return; }
    showToast(t('mc_pp_saved'));
    onSaved?.(p);
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
      title={t('mc_pp_title')}
      footer={
        <button onClick={save} disabled={saving || loading} style={{ minHeight: 48 }}
          className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
            : <><i className="ri-save-line"></i> {t('mc_pp_save')}</>}
        </button>
      }
    >
      {loading ? (
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

          {/* Días + minutos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('mc_pp_days')}</label>
              <input value={p.training_days_per_week ?? ''} inputMode="numeric" placeholder="0" style={{ fontSize: 16, minHeight: 44 }}
                onChange={(e) => set('training_days_per_week', num(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('mc_pp_minutes')}</label>
              <input value={p.session_minutes ?? ''} inputMode="numeric" placeholder="0" style={{ fontSize: 16, minHeight: 44 }}
                onChange={(e) => set('session_minutes', num(e.target.value))} className={inputCls} />
            </div>
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

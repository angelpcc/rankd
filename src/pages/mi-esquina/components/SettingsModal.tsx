import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onClose: () => void;
}

interface Prefs {
  training_reminder_enabled: boolean;
  training_reminder_time: string;
  weight_reminder_enabled: boolean;
}

const DEFAULT_PREFS: Prefs = {
  training_reminder_enabled: true,
  training_reminder_time: '17:00',
  weight_reminder_enabled: false,
};

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors cursor-pointer ${on ? 'bg-red-600' : 'bg-white/[0.12]'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

/**
 * Ajustes de Mi Esquina, de momento solo Notificaciones. Guarda en
 * user_preferences (migración 0038) y useNotifications lo lee para decidir
 * si generar los recordatorios in-app (la campana) al abrir la app. El envío
 * push real es posterior — esto es solo la preferencia + el aviso in-app.
 */
export default function SettingsModal({ profile, showToast, onClose }: Props) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences').select('*').eq('fighter_profile_id', profile.id).maybeSingle();
      if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
      if (data) {
        setPrefs({
          training_reminder_enabled: data.training_reminder_enabled,
          training_reminder_time: (data.training_reminder_time || '17:00').slice(0, 5),
          weight_reminder_enabled: data.weight_reminder_enabled,
        });
      }
      setLoading(false);
    })();
  }, [profile.id]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('user_preferences').upsert({
      fighter_profile_id: profile.id,
      training_reminder_enabled: prefs.training_reminder_enabled,
      training_reminder_time: prefs.training_reminder_time,
      weight_reminder_enabled: prefs.weight_reminder_enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fighter_profile_id' });
    setSaving(false);
    if (error) { showToast(t('mc_set_save_fail'), 'error'); return; }
    showToast(t('mc_set_saved'));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div className="relative rk-card w-full max-w-sm max-h-[90vh] overflow-y-auto" style={{ padding: 24, transform: 'none' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{t('mc_set_title')}</h3>
          <button onClick={onClose} aria-label={t('mc_close')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-close-line"></i>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : unavailable ? (
          <p className="text-sm text-zinc-400">{t('mc_set_unavailable')}</p>
        ) : (
          <div className="space-y-5">
            <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-zinc-500">{t('mc_set_notifications')}</p>

            <div className="flex items-center gap-3">
              <Toggle on={prefs.training_reminder_enabled} label={t('mc_set_training_toggle')}
                onChange={(v) => setPrefs((p) => ({ ...p, training_reminder_enabled: v }))} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t('mc_set_training_toggle')}</p>
                <p className="text-xs text-zinc-500">{t('mc_set_training_desc')}</p>
              </div>
            </div>

            {prefs.training_reminder_enabled && (
              <div className="pl-[3.4rem] -mt-2">
                <label className="block text-[11px] text-zinc-400 mb-1.5">{t('mc_set_training_time')}</label>
                <input type="time" value={prefs.training_reminder_time}
                  onChange={(e) => setPrefs((p) => ({ ...p, training_reminder_time: e.target.value }))}
                  className="bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-red-500 [color-scheme:dark]" />
              </div>
            )}

            <div className="rk-rule" style={{ opacity: 0.4 }} />

            <div className="flex items-center gap-3">
              <Toggle on={prefs.weight_reminder_enabled} label={t('mc_set_weight_toggle')}
                onChange={(v) => setPrefs((p) => ({ ...p, weight_reminder_enabled: v }))} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t('mc_set_weight_toggle')}</p>
                <p className="text-xs text-zinc-500">{t('mc_set_weight_desc')}</p>
              </div>
            </div>

            <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
              <i className="ri-information-line mt-0.5 flex-shrink-0"></i>{t('mc_set_hint')}
            </p>

            <button onClick={save} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
                : <><i className="ri-check-line"></i> {t('mc_save')}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

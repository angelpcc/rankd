import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import Reveal from '@/components/base/Reveal';
import StrengthPlanBuilder from './StrengthPlanBuilder';
import { exerciseLines, type StrengthPayload, type ExerciseSpec } from '../lib/dayPlan';

// Fuerza · nivel 2 · Programar.
// Planifica fuerza en detalle para un día concreto (reutiliza
// StrengthPlanBuilder, el mismo flujo que la Agenda) y lista lo ya
// programado de aquí en adelante. Escribe en day_plan_items kind='strength'.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface PlanRow { id: string; plan_date: string; payload: StrengthPayload; completed: boolean }

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StrengthProgram({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [builderOpen, setBuilderOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('day_plan_items')
      .select('id, plan_date, payload, completed')
      .eq('fighter_profile_id', profile.id)
      .eq('kind', 'strength')
      .gte('plan_date', todayISO())
      .order('plan_date', { ascending: true })
      .limit(60);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setRows((data || []) as PlanRow[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { void load(); }, [load]);

  const savePlan = async (payload: { groups: string[]; exercises: ExerciseSpec[] }) => {
    const { data, error } = await supabase.from('day_plan_items').insert({
      fighter_profile_id: profile.id,
      plan_date: date,
      kind: 'strength',
      payload,
      source: 'manual',
    }).select().maybeSingle();
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setRows((p) => [...p, data as PlanRow].sort((a, b) => a.plan_date.localeCompare(b.plan_date)));
    setBuilderOpen(false);
    showToast(t('mc_strp_saved'));
  };

  const remove = async (id: string) => {
    setRows((p) => p.filter((r) => r.id !== id));
    const { error } = await supabase.from('day_plan_items').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto mt-6" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25">
          <i className="ri-calendar-todo-line text-3xl text-red-400" />
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-6 max-w-3xl">
      <header>
        <p className="rk-eyebrow">{t('mc_strp_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>{t('mc_strp_title')}</h2>
        <p className="rk-body-14 mt-1">{t('mc_strp_sub')}</p>
      </header>

      <div className="rk-card flex flex-wrap items-end gap-3" style={{ padding: 18 }}>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_strp_date')}</label>
          <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)}
            style={{ fontSize: 16, minHeight: 44 }}
            className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer [color-scheme:dark]" />
        </div>
        <button onClick={() => setBuilderOpen(true)}
          className="rk-btn rk-btn-primary flex items-center gap-2" style={{ fontSize: '0.85rem', minHeight: 44 }}>
          <i className="ri-add-line" />{t('mc_strp_add')}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 py-6 text-center">{t('mc_strp_empty')}</p>
      ) : (
        <div className="rk-stack">
          {rows.map((r, i) => {
            const groups = (r.payload.groups || []).map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ');
            const lines = exerciseLines(r.payload.exercises, t);
            return (
              <Reveal key={r.id} delay={Math.min(i, 6) * 40}>
                <div className="rk-card" style={{ padding: '14px 16px' }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 capitalize">{fmtDate(r.plan_date)}</p>
                      <p className="text-sm font-bold text-white mt-0.5">{groups || t('mc_dp_kind_strength')}</p>
                      {lines.length > 0 && (
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{lines.slice(0, 4).join(' · ')}</p>
                      )}
                    </div>
                    {r.completed && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 flex-shrink-0"><i className="ri-check-line" /></span>
                    )}
                    <button onClick={() => remove(r.id)} aria-label={t('mc_delete')}
                      className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer flex-shrink-0">
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      <StrengthPlanBuilder
        open={builderOpen}
        fighterProfileId={profile.id}
        onClose={() => setBuilderOpen(false)}
        onSave={savePlan}
      />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  onOpenCalendar?: () => void;
}

interface FightEvent {
  id: string;
  event_date: string;
  title: string;
  kind: string;
}

/**
 * Fases de preparación por días restantes. Los cortes siguen la lógica clásica
 * de un campamento: base larga, trabajo específico, afinado, ajuste de peso y
 * semana de pelea. Son orientativos, no dogma.
 */
const PHASES = [
  { min: 43, id: 'base', nameKey: 'mc_fp_phase_base', descKey: 'mc_fp_phase_base_desc', color: '#38bdf8', icon: 'ri-hammer-line' },
  { min: 22, id: 'build', nameKey: 'mc_fp_phase_build', descKey: 'mc_fp_phase_build_desc', color: '#4ade80', icon: 'ri-boxing-line' },
  { min: 15, id: 'peak', nameKey: 'mc_fp_phase_peak', descKey: 'mc_fp_phase_peak_desc', color: '#C9A84C', icon: 'ri-focus-3-line' },
  { min: 8, id: 'cut', nameKey: 'mc_fp_phase_cut', descKey: 'mc_fp_phase_cut_desc', color: '#fb923c', icon: 'ri-scales-2-line' },
  { min: 0, id: 'fight_week', nameKey: 'mc_fp_phase_fight_week', descKey: 'mc_fp_phase_fight_week_desc', color: '#E10600', icon: 'ri-sword-line' },
];

function phaseFor(days: number) {
  return PHASES.find((p) => days >= p.min) || PHASES[PHASES.length - 1];
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Cuenta atrás al próximo combate y fase de preparación en la que estás.
 * Solo tiene sentido para el peleador que compite: es lo primero que quiere
 * ver al abrir su esquina.
 */
export default function FightPrep({ profile, onOpenCalendar }: Props) {
  const { t, i18n } = useTranslation();
  const [fight, setFight] = useState<FightEvent | null>(null);
  const [weighIn, setWeighIn] = useState<FightEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('planned_events')
      .select('id, event_date, title, kind')
      .eq('fighter_profile_id', profile.id)
      .in('kind', ['fight', 'weigh_in'])
      .gte('event_date', todayISO())
      .order('event_date', { ascending: true });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    const rows = (data || []) as FightEvent[];
    setFight(rows.find((r) => r.kind === 'fight') || null);
    setWeighIn(rows.find((r) => r.kind === 'weigh_in') || null);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  if (loading || unavailable) return null;

  // ── Sin combate marcado: no aporta valor, no se muestra nada (el espacio
  //    lo ganan las demás cards del resumen). ──
  if (!fight) return null;

  const days = Math.round((new Date(fight.event_date + 'T12:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const phase = phaseFor(days);
  // Progreso dentro de un campamento estándar de 12 semanas
  const campDays = 84;
  const progress = Math.max(0, Math.min(100, Math.round(((campDays - days) / campDays) * 100)));

  return (
    <div className="rk-card relative overflow-hidden" style={{ padding: '20px', transform: 'none', borderColor: `${phase.color}44` }}>
      <div className="rk-glow-red" style={{ width: 220, height: 220, top: -110, right: -60, borderRadius: '50%', background: `radial-gradient(circle, ${phase.color}22 0%, transparent 68%)` }} />

      <div className="relative">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase" style={{ color: phase.color }}>{t('mc_fp_next_fight')}</p>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 1, color: '#fff', marginTop: 4, lineHeight: 1.05 }}>
              {fight.title}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 capitalize">
              {new Date(fight.event_date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Cuenta atrás */}
          <div className="text-right flex-shrink-0">
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, lineHeight: 0.85, color: phase.color }}>
              {days <= 0 ? '0' : days}
            </p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {days === 0 ? t('mc_fp_is_today') : days === 1 ? t('mc_fp_day_left') : t('mc_fp_days_left')}
            </p>
          </div>
        </div>

        {/* Barra de campamento */}
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-4">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: phase.color }} />
        </div>

        {/* Fase actual */}
        <div className="flex items-start gap-3 mt-4 rounded-xl border p-3.5"
          style={{ background: `${phase.color}0e`, borderColor: `${phase.color}33` }}>
          <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border"
            style={{ background: `${phase.color}1a`, borderColor: `${phase.color}44`, color: phase.color }}>
            <i className={phase.icon}></i>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t('mc_fp_phase')}</p>
            <p className="text-sm font-bold" style={{ color: phase.color }}>{t(phase.nameKey)}</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t(phase.descKey)}</p>
          </div>
        </div>

        {/* Pesaje */}
        {weighIn && (
          <div className="flex items-center gap-2.5 mt-3 text-xs text-zinc-400">
            <i className="ri-scales-2-line text-[#C9A84C]"></i>
            <span className="font-bold text-[#C9A84C]">{t('mc_fp_weigh_in')}:</span>
            <span className="capitalize">
              {new Date(weighIn.event_date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

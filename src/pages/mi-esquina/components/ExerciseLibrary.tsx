import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MUSCLE_GROUPS, exLabel, filterExercises, availableEquipment, availablePatterns,
  type MuscleGroup, type Equipment, type MovementPattern, type LibExercise,
} from '../lib/exercises';
import { hasTechnique } from '../lib/exerciseTechnique';
import ExerciseTechniqueCard from './ExerciseTechniqueCard';
import StateBlock from '@/components/base/StateBlock';

// Fuerza · nivel 2 · Biblioteca de ejercicios.
// Buscador + filtros por grupo, material, patrón de movimiento y unilateral.
// Al tocar un ejercicio se abre su ficha (metadatos + técnica si la tiene).

const EQUIPMENT_ICON: Record<Equipment, string> = {
  barbell: 'ri-boxing-line', dumbbell: 'ri-dumbbell-line', cable: 'ri-links-line',
  machine: 'ri-settings-3-line', bodyweight: 'ri-user-line', kettlebell: 'ri-basketball-line',
  band: 'ri-loop-right-line', ball: 'ri-football-line', sled: 'ri-truck-line',
};

export default function ExerciseLibrary() {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [pattern, setPattern] = useState<MovementPattern | 'all'>('all');
  const [unilateralOnly, setUnilateralOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const equipments = useMemo(() => availableEquipment(), []);
  const patterns = useMemo(() => availablePatterns(), []);
  const hasFilters = group !== 'all' || equipment !== 'all' || pattern !== 'all' || unilateralOnly || q.trim() !== '';

  const list = useMemo(
    () => filterExercises({ group, equipment, pattern, unilateralOnly, query: q })
      .sort((a, b) => exLabel(a, lang).localeCompare(exLabel(b, lang), lang)),
    [q, group, equipment, pattern, unilateralOnly, lang],
  );

  const clearAll = () => { setGroup('all'); setEquipment('all'); setPattern('all'); setUnilateralOnly(false); setQ(''); };

  const chip = (active: boolean, label: string, onClick: () => void, key: string) => (
    <button key={key} onClick={onClick} aria-pressed={active}
      className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${active ? 'is-active' : ''}`}
      style={{ padding: '0.4rem 0.9rem', minHeight: 36 }}>
      {label}
    </button>
  );

  const Row = ({ e }: { e: LibExercise }) => {
    const label = exLabel(e, lang);
    const isOpen = open === label;
    const tech = hasTechnique(exLabel(e, 'en'));
    return (
      <div className="rk-card" style={{ padding: 0, overflow: 'hidden' }}>
        <button onClick={() => setOpen(isOpen ? null : label)} aria-expanded={isOpen}
          className="w-full text-left flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ minHeight: 56 }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--t-3)' }}>
              {t(`mc_str_mg_${e.group}`)}
              {e.equipment && ` · ${t(`mc_eq_${e.equipment}`)}`}
              {e.pattern && ` · ${t(`mc_pat_${e.pattern}`)}`}
              {e.unilateral && ` · ${t('mc_exlib_f_unilateral')}`}
            </p>
          </div>
          {tech && (
            <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--accent)' }}>
              {t('mc_exlib_has_tech')}
            </span>
          )}
          <i className={`ri-arrow-down-s-line flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--t-3)' }} />
        </button>
        {isOpen && (
          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {e.equipment && (
                <span className="rk-surface-2 text-[11px] px-2.5 py-1 inline-flex items-center gap-1.5" style={{ color: 'var(--t-2)' }}>
                  <i className={EQUIPMENT_ICON[e.equipment]} />{t(`mc_eq_${e.equipment}`)}
                </span>
              )}
              {e.difficulty && (
                <span className="rk-surface-2 text-[11px] px-2.5 py-1" style={{ color: 'var(--t-2)' }}>
                  {t(`mc_diff_${e.difficulty}`)}
                </span>
              )}
              {e.secondary?.map((s) => (
                <span key={s} className="rk-surface-2 text-[11px] px-2.5 py-1" style={{ color: 'var(--t-3)' }}>
                  + {t(`mc_str_mg_${s}`)}
                </span>
              ))}
            </div>
            {tech
              ? <ExerciseTechniqueCard name={label} />
              : <p className="text-xs leading-relaxed" style={{ color: 'var(--t-3)' }}>{t('mc_exlib_no_tech_desc')}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 mt-6 max-w-3xl">
      <header>
        <p className="rk-eyebrow">{t('mc_exlib_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>{t('mc_exlib_title')}</h2>
        <p className="rk-body-14 mt-1">{t('mc_exlib_sub')}</p>
      </header>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mc_exlib_search_ph')}
        aria-label={t('mc_exlib_search_ph')} style={{ fontSize: 16, minHeight: 44 }}
        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />

      {/* Grupo muscular */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x" role="group" aria-label={t('mc_exlib_f_group')}>
        {chip(group === 'all', t('mc_exlib_all'), () => setGroup('all'), 'g-all')}
        {MUSCLE_GROUPS.map((g) => chip(group === g, t(`mc_str_mg_${g}`), () => setGroup(g), `g-${g}`))}
      </div>

      {/* Material */}
      <div>
        <p className="rk-label mb-1.5">{t('mc_exlib_f_equipment')}</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x" role="group" aria-label={t('mc_exlib_f_equipment')}>
          {chip(equipment === 'all', t('mc_exlib_all'), () => setEquipment('all'), 'e-all')}
          {equipments.map((x) => chip(equipment === x, t(`mc_eq_${x}`), () => setEquipment(x), `e-${x}`))}
        </div>
      </div>

      {/* Patrón de movimiento + unilateral */}
      <div>
        <p className="rk-label mb-1.5">{t('mc_exlib_f_pattern')}</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x" role="group" aria-label={t('mc_exlib_f_pattern')}>
          {chip(pattern === 'all', t('mc_exlib_all'), () => setPattern('all'), 'p-all')}
          {patterns.map((x) => chip(pattern === x, t(`mc_pat_${x}`), () => setPattern(x), `p-${x}`))}
          {chip(unilateralOnly, t('mc_exlib_f_unilateral'), () => setUnilateralOnly((v) => !v), 'p-uni')}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: 'var(--t-3)' }}>{t('mc_exlib_count', { n: list.length })}</p>
        {hasFilters && (
          <button onClick={clearAll} style={{ minHeight: 36 }}
            className="text-xs font-bold cursor-pointer inline-flex items-center gap-1.5" data-testid="clear-filters">
            <i className="ri-close-circle-line" style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--t-2)' }}>{t('mc_exlib_clear')}</span>
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <StateBlock variant="empty" art="search" title={t('mc_exlib_none')}
          action={{ label: t('mc_exlib_clear'), onClick: clearAll }} />
      ) : (
        <div className="rk-stack">
          {list.map((e) => <Row key={`${e.es}|${e.en}`} e={e} />)}
        </div>
      )}

      <style>{`.rk-noscroll-x::-webkit-scrollbar{display:none}.rk-noscroll-x{scrollbar-width:none}`}</style>
    </div>
  );
}

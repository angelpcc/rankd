import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MUSCLE_GROUPS, exLabel, filterExercises, availableEquipment, availablePatterns,
  focusesForGroup, fighterExerciseCount,
  type MuscleGroup, type Equipment, type MovementPattern, type LibExercise,
} from '../lib/exercises';
import { hasTechnique } from '../lib/exerciseTechnique';
import ExerciseTechniqueCard from './ExerciseTechniqueCard';
import StateBlock from '@/components/base/StateBlock';

// Fuerza · nivel 2 · Biblioteca de ejercicios.
// Buscador + filtros por grupo, material, patrón de movimiento y unilateral.
// Al tocar un ejercicio se abre su ficha (metadatos + técnica si la tiene).
//
// REPERTORIO DE PELEADOR (punto 19): la biblioteca nació orientada a quien va a
// un gimnasio con máquinas, y mucha gente que compite no pisa uno. Los
// ejercicios marcados `fighter` —dominadas y variantes, calistenia, cuerdas,
// pliometría, core rotacional, cuello, mazo y neumático— llevan distintivo
// propio, tienen su filtro y, en una cuenta de competidor, salen los primeros
// de la lista y con una tarjeta que los presenta.
//
// No se le esconde nada al aficionado: ve exactamente los mismos ejercicios y
// tiene el mismo filtro. Lo único que cambia es el ORDEN por defecto y si se
// pinta o no la tarjeta de presentación.

const EQUIPMENT_ICON: Record<Equipment, string> = {
  barbell: 'ri-boxing-line', dumbbell: 'ri-dumbbell-line', cable: 'ri-links-line',
  machine: 'ri-settings-3-line', bodyweight: 'ri-user-line', kettlebell: 'ri-basketball-line',
  band: 'ri-loop-right-line', ball: 'ri-football-line', sled: 'ri-truck-line',
  rope: 'ri-link-unlink', odd: 'ri-hammer-line',
};

interface Props {
  /**
   * Cuenta de competición. Solo cambia la PRESENTACIÓN: pone delante el
   * repertorio de peleador y enseña la tarjeta que lo explica.
   */
  isPro?: boolean;
}

export default function ExerciseLibrary({ isPro = false }: Props) {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [pattern, setPattern] = useState<MovementPattern | 'all'>('all');
  const [unilateralOnly, setUnilateralOnly] = useState(false);
  const [fighterOnly, setFighterOnly] = useState(false);
  // Zona dentro del grupo (tirón vertical, femoral, dorsal aislado...). Es el
  // filtro que hace usable la lista: con más de 200 ejercicios, "espalda" a
  // secas devuelve treinta y encontrar el que buscas cuesta más que no filtrar.
  const [focus, setFocus] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);

  const equipments = useMemo(() => availableEquipment(), []);
  const patterns = useMemo(() => availablePatterns(), []);
  const fighterTotal = useMemo(() => fighterExerciseCount(), []);
  // Solo las zonas que existen en el grupo elegido: filtrar "pierna" no debe
  // ofrecer "tirón vertical".
  const focuses = useMemo(() => focusesForGroup(group), [group]);
  // Al cambiar de grupo, la zona anterior deja de tener sentido.
  useEffect(() => { setFocus('all'); }, [group]);

  const hasFilters = group !== 'all' || equipment !== 'all' || pattern !== 'all'
    || focus !== 'all' || unilateralOnly || fighterOnly || q.trim() !== '';

  const list = useMemo(() => {
    const base = filterExercises({ group, equipment, pattern, focus, unilateralOnly, fighterOnly, query: q });
    const byName = (a: LibExercise, b: LibExercise) => exLabel(a, lang).localeCompare(exLabel(b, lang), lang);
    // En una cuenta de competidor y sin filtrar nada, el repertorio de peleador
    // va delante. Es lo que hace que se VEA sin esconder el resto: se sigue
    // llegando a todo bajando la lista.
    if (isPro && !fighterOnly) {
      return base.sort((a, b) => {
        const d = Number(!!b.fighter) - Number(!!a.fighter);
        return d !== 0 ? d : byName(a, b);
      });
    }
    return base.sort(byName);
  }, [q, group, equipment, pattern, focus, unilateralOnly, fighterOnly, lang, isPro]);

  const clearAll = () => {
    setGroup('all'); setEquipment('all'); setPattern('all'); setFocus('all');
    setUnilateralOnly(false); setFighterOnly(false); setQ('');
  };

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
            <p className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
              {label}
              {e.fighter && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(225,6,0,0.14)', border: '1px solid rgba(225,6,0,0.35)', color: '#ff6b66' }}>
                  {t('mc_exlib_fighter_badge')}
                </span>
              )}
            </p>
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

      {/* Presentación del repertorio de peleador. Se enseña en la cuenta de
          competición porque es a quien le cambia la vida no depender de una
          sala de máquinas. El aficionado tiene el mismo filtro justo debajo. */}
      {isPro && !fighterOnly && (
        <div className="rk-card relative overflow-hidden" style={{ padding: 18, borderColor: 'rgba(225,6,0,0.28)' }}>
          <div className="rk-glow-red" style={{ width: 180, height: 180, top: -80, right: -60, borderRadius: '50%' }} />
          <div className="relative flex items-start gap-3">
            <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400">
              <i className="ri-boxing-line text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">{t('mc_exlib_fighter_title')}</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t('mc_exlib_fighter_desc')}</p>
              <button onClick={() => setFighterOnly(true)}
                className="rk-nav-btn text-xs flex items-center gap-1.5 mt-3"
                style={{ padding: '0.5rem 0.95rem', minHeight: 42 }}>
                <i className="ri-filter-3-line" />{t('mc_exlib_fighter_cta', { n: fighterTotal })}
              </button>
            </div>
          </div>
        </div>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mc_exlib_search_ph')}
        aria-label={t('mc_exlib_search_ph')} style={{ fontSize: 16, minHeight: 44 }}
        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />

      {/* Repertorio de peleador: va ARRIBA del todo y no dentro del cajón de
          patrones, porque es el filtro que decide si la biblioteca te sirve
          cuando entrenas en un gimnasio de combate y no en una sala. */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFighterOnly((v) => !v)} aria-pressed={fighterOnly}
          className="text-xs font-bold whitespace-nowrap rounded-xl border transition-all cursor-pointer inline-flex items-center gap-1.5"
          style={{
            padding: '0.45rem 0.95rem', minHeight: 40,
            background: fighterOnly ? 'rgba(225,6,0,0.16)' : 'var(--s-2)',
            borderColor: fighterOnly ? 'rgba(225,6,0,0.5)' : 'var(--s-3)',
            color: fighterOnly ? '#fff' : 'var(--t-2)',
          }}>
          <i className="ri-boxing-line" />{t('mc_exlib_fighter')}
          <span style={{ opacity: 0.6 }}>{fighterTotal}</span>
        </button>
        {fighterOnly && (
          <span className="text-[11px] leading-relaxed" style={{ color: 'var(--t-3)' }}>
            {t('mc_exlib_fighter_on')}
          </span>
        )}
      </div>

      {/* Grupo muscular */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x" role="group" aria-label={t('mc_exlib_f_group')}>
        {chip(group === 'all', t('mc_exlib_all'), () => setGroup('all'), 'g-all')}
        {MUSCLE_GROUPS.map((g) => chip(group === g, t(`mc_str_mg_${g}`), () => setGroup(g), `g-${g}`))}
      </div>

      {/* Zona dentro del grupo. Va JUSTO debajo del grupo porque es el filtro
          que de verdad reduce la lista: eliges "espalda" y luego "tirón
          vertical" o "remo", en vez de leerte los treinta. */}
      {focuses.length > 1 && (
        <div>
          <p className="rk-label mb-1.5">{t('mc_exlib_f_focus')}</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x" role="group" aria-label={t('mc_exlib_f_focus')}>
            {chip(focus === 'all', t('mc_exlib_all'), () => setFocus('all'), 'f-all')}
            {focuses.map((x) => chip(focus === x, t(`mc_focus_${x}`), () => setFocus(x), `f-${x}`))}
          </div>
        </div>
      )}

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

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EXERCISE_LIBRARY, MUSCLE_GROUPS, exLabel, type MuscleGroup } from '../lib/exercises';
import { hasTechnique } from '../lib/exerciseTechnique';
import ExerciseTechniqueCard from './ExerciseTechniqueCard';

// Fuerza · nivel 2 · Biblioteca de ejercicios.
// Buscador + filtro por grupo. Al tocar un ejercicio se abre su ficha de
// técnica (ExerciseTechniqueCard, contenido estático). Acceso propio dentro
// del nivel 2, no solo embebido al escribir un ejercicio en el registro.

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function ExerciseLibrary() {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = norm(q);
    return EXERCISE_LIBRARY
      .filter((e) => (group === 'all' || e.group === group))
      .filter((e) => !needle || norm(exLabel(e, 'es')).includes(needle) || norm(exLabel(e, 'en')).includes(needle))
      .map((e) => ({ label: exLabel(e, lang), group: e.group, tech: hasTechnique(exLabel(e, 'en')) }))
      .sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'es'));
  }, [q, group, lang]);

  return (
    <div className="space-y-4 mt-6 max-w-3xl">
      <header>
        <p className="rk-eyebrow">{t('mc_exlib_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>{t('mc_exlib_title')}</h2>
        <p className="rk-body-14 mt-1">{t('mc_exlib_sub')}</p>
      </header>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mc_exlib_search_ph')}
        style={{ fontSize: 16, minHeight: 44 }}
        className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />

      <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x">
        <button onClick={() => setGroup('all')}
          className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${group === 'all' ? 'is-active' : ''}`}
          style={{ padding: '0.4rem 0.9rem' }}>
          {t('mc_exlib_all')}
        </button>
        {MUSCLE_GROUPS.map((g) => (
          <button key={g} onClick={() => setGroup(g)}
            className={`rk-nav-btn text-xs font-bold whitespace-nowrap ${group === g ? 'is-active' : ''}`}
            style={{ padding: '0.4rem 0.9rem' }}>
            {t(`mc_str_mg_${g}`)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8 text-center">{t('mc_exlib_none')}</p>
      ) : (
        <div className="rk-stack">
          {list.map((e) => {
            const isOpen = open === e.label;
            return (
              <div key={e.label} className="rk-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button onClick={() => setOpen(isOpen ? null : e.label)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{e.label}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t(`mc_str_mg_${e.group}`)}</p>
                  </div>
                  {e.tech
                    ? <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C] flex-shrink-0">{t('mc_exlib_has_tech')}</span>
                    : <span className="text-[10px] text-zinc-600 flex-shrink-0">{t('mc_exlib_no_tech')}</span>}
                  <i className={`ri-arrow-down-s-line text-zinc-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    {e.tech
                      ? <ExerciseTechniqueCard name={e.label} />
                      : <p className="text-xs text-zinc-500 leading-relaxed mt-1">{t('mc_exlib_no_tech_desc')}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`.rk-noscroll-x::-webkit-scrollbar{display:none}.rk-noscroll-x{scrollbar-width:none}`}</style>
    </div>
  );
}

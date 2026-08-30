import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MOBILITY_ROUTINES, mobilityDoneToday, toggleMobilityDone, routineSeconds,
  type MobilityRoutine, type MobilityZone,
} from '../lib/mobility';

// Fuerza · nivel 2 · Movilidad y estiramientos.
// Contenido de consulta: rutinas por zona con sus movimientos y segundos. No
// se registra por serie; solo un tick "hecho hoy" (localStorage, sin BD).

function fmtSecs(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m} min`;
}

export default function MobilityRoutines() {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  const [open, setOpen] = useState<MobilityZone | null>(null);
  const [done, setDone] = useState<Set<MobilityZone>>(() => mobilityDoneToday());

  const toggle = (zone: MobilityZone) => setDone(toggleMobilityDone(zone));

  return (
    <div className="space-y-4 mt-6 max-w-3xl">
      <header>
        <p className="rk-eyebrow">{t('mc_mob_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_mob_title')}
        </h2>
        <p className="rk-body-14 mt-1">{t('mc_mob_sub')}</p>
      </header>

      <div className="rk-stack">
        {MOBILITY_ROUTINES.map((r: MobilityRoutine) => {
          const isOpen = open === r.id;
          const isDone = done.has(r.id);
          return (
            <div key={r.id} className="rk-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Cabecera con fondo diseñado (sin ilustración disponible) */}
              <button onClick={() => setOpen(isOpen ? null : r.id)}
                className="w-full text-left relative flex items-center gap-3.5 px-4 py-3.5 cursor-pointer">
                <div className="absolute inset-0 rk-grid-bg" style={{ opacity: 0.35 }} />
                <div className="rk-glow-red" style={{ inset: '-60% 40% auto -10%', height: '160%' }} />
                <i className={r.icon} style={{ position: 'absolute', right: -6, bottom: -18, fontSize: 74, color: 'rgba(255,255,255,0.05)' }} />
                <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400">
                  <i className={`${r.icon} text-lg`} />
                </div>
                <div className="relative flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{r.title[lang]}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{r.subtitle[lang]}</p>
                </div>
                <div className="relative flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-semibold text-zinc-500">{r.moves.length} · {fmtSecs(routineSeconds(r))}</span>
                  <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 space-y-2">
                  {r.moves.map((m, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-6 flex-shrink-0 text-center text-[11px] font-bold text-zinc-600 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200">{m.name[lang]}</p>
                        <p className="text-[11px] text-zinc-500 leading-relaxed">{m.cue[lang]}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs font-semibold text-[#C9A84C]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {m.seconds}s{m.perSide ? ` ${t('mc_mob_per_side')}` : ''}
                      </span>
                    </div>
                  ))}

                  <button onClick={() => toggle(r.id)}
                    className={`mt-2 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold cursor-pointer transition-colors border ${
                      isDone
                        ? 'bg-green-500/12 border-green-500/35 text-green-300'
                        : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/25'}`}>
                    <i className={isDone ? 'ri-check-double-line' : 'ri-check-line'} />
                    {isDone ? t('mc_mob_done') : t('mc_mob_mark_done')}
                  </button>
                </div>
              )}

              {!isOpen && isDone && (
                <div className="px-4 pb-3 -mt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
                    <i className="ri-check-line" />{t('mc_mob_done_today')}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5 pt-2">
        <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_mob_disclaimer')}
      </p>
    </div>
  );
}

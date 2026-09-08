import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FULL_ROUTINES, ZONE_ICON, itemsFor, mobilityDoneToday,
  routineItems, toggleMobilityDone, totalSeconds, zonesWith,
  type MobilityItem, type MobilityKind, type MobilityZone,
} from '../lib/mobility';

// Fuerza · pestaña "Movilidad y Estiramientos".
//
// Dos sub-apartados claramente separados, porque NO son lo mismo: movilidad es
// movimiento activo antes de entrenar; estiramiento es posición sostenida,
// después. Dentro de cada uno se elige ZONA del cuerpo, para poder ir directo
// a lo que molesta en vez de leer una lista larga.
//
// Al final, aparte, las dos rutinas completas (antes y después de entrenar)
// para quien no quiere elegir. Referencian los mismos ítems, así que el texto
// nunca se contradice.

function fmtSecs(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m} min`;
}

export default function MobilityRoutines() {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';

  const [kind, setKind] = useState<MobilityKind>('mobility');
  const zones = useMemo(() => zonesWith(kind), [kind]);
  // Zona elegida por tipo: al cambiar de sub-apartado no se pierde dónde
  // estabas en el otro.
  const [zoneBy, setZoneBy] = useState<Record<MobilityKind, MobilityZone>>({
    mobility: 'shoulder', stretch: 'legs',
  });
  const zone = zones.includes(zoneBy[kind]) ? zoneBy[kind] : zones[0];
  const setZone = (z: MobilityZone) => setZoneBy((p) => ({ ...p, [kind]: z }));

  const [howOpen, setHowOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(() => mobilityDoneToday());
  const toggle = (key: string) => setDone(toggleMobilityDone(key));

  const items = useMemo(() => itemsFor(kind, zone), [kind, zone]);
  const doneKey = `${kind}:${zone}`;
  const isDone = done.has(doneKey);

  const Item = ({ m, idPrefix }: { m: MobilityItem; idPrefix: string }) => {
    const key = `${idPrefix}:${m.id}`;
    const open = howOpen === key;
    return (
      <div className="flex items-start gap-3">
        <span className="w-6 flex-shrink-0 flex items-center justify-center mt-0.5" aria-hidden>
          <i className={ZONE_ICON[m.zone]} style={{ color: 'var(--t-3)', fontSize: 14 }} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200">{m.name[lang]}</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{m.cue[lang]}</p>
          <button type="button" onClick={() => setHowOpen(open ? null : key)} aria-expanded={open}
            style={{ minHeight: 32 }}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white cursor-pointer">
            <i className={open ? 'ri-arrow-up-s-line' : 'ri-information-line'} />
            {t('mc_mob_how')}
          </button>
          {open && (
            <p className="mt-1 text-[11px] text-zinc-300 leading-relaxed rounded-lg px-2.5 py-2"
              style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
              {m.how[lang]}
            </p>
          )}
        </div>
        <span className="flex-shrink-0 text-xs font-semibold text-[#C9A84C]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          {m.seconds}s{m.perSide ? ` ${t('mc_mob_per_side')}` : ''}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4 mt-6 max-w-3xl">
      <header>
        <p className="rk-eyebrow">{t('mc_mob_eyebrow')}</p>
        <h2 className="rk-h3" style={{ fontSize: '1.25rem', color: '#fff', margin: '4px 0 0' }}>
          {t('mc_mob_title')}
        </h2>
        <p className="rk-body-14 mt-1">{t('mc_mob_sub')}</p>
      </header>

      {/* ── Sub-apartados: son dos cosas distintas, no una lista mezclada ── */}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('mc_mob_title')}>
        {(['mobility', 'stretch'] as MobilityKind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
            style={{ minHeight: 60 }}
            className={`text-left rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
              kind === k ? 'border-red-500/45 bg-red-600/12' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}>
            <p className={`text-sm font-bold ${kind === k ? 'text-red-400' : 'text-white'}`}>
              {t(k === 'mobility' ? 'mc_mob_kind_mobility' : 'mc_mob_kind_stretch')}
            </p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--t-3)' }}>
              {t(k === 'mobility' ? 'mc_mob_kind_mobility_sub' : 'mc_mob_kind_stretch_sub')}
            </p>
          </button>
        ))}
      </div>

      {/* ── Zona del cuerpo ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">{t('mc_mob_zone')}</p>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label={t('mc_mob_zone')}>
          {zones.map((z) => (
            <button key={z} onClick={() => setZone(z)} aria-pressed={zone === z}
              className={`rk-nav-btn text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 ${zone === z ? 'is-active' : ''}`}
              style={{ padding: '0.4rem 0.9rem', minHeight: 36 }}>
              <i className={ZONE_ICON[z]} />{t(`mc_mob_zone_${z}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ejercicios de la zona elegida ── */}
      <div className="rk-card" style={{ padding: 16 }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-bold text-white">
            {t(`mc_mob_zone_${zone}`)}
            <span className="text-zinc-500 font-normal"> · {items.length} · {fmtSecs(totalSeconds(items))}</span>
          </p>
          {isDone && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-400 flex-shrink-0">
              <i className="ri-check-line" />{t('mc_mob_done_today')}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {items.map((m) => <Item key={m.id} m={m} idPrefix={doneKey} />)}
        </div>

        <button onClick={() => toggle(doneKey)}
          className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold cursor-pointer transition-colors border ${
            isDone
              ? 'bg-green-500/12 border-green-500/35 text-green-300'
              : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/25'}`}>
          <i className={isDone ? 'ri-check-double-line' : 'ri-check-line'} />
          {isDone ? t('mc_mob_done') : t('mc_mob_mark_done')}
        </button>
      </div>

      {/* ── Rutinas completas ──
          Aparte de los dos sub-apartados, para quien no quiere elegir zona. */}
      <div className="pt-2">
        <h3 className="rk-label mb-2">{t('mc_mob_full_routines')}</h3>
        <div className="rk-stack">
          {FULL_ROUTINES.map((r) => {
            const list = routineItems(r);
            const open = howOpen === `routine:${r.id}`;
            const rDone = done.has(r.id);
            return (
              <div key={r.id} className="rk-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button onClick={() => setHowOpen(open ? null : `routine:${r.id}`)} aria-expanded={open}
                  className="w-full text-left flex items-center gap-3.5 px-4 py-3.5 cursor-pointer" style={{ minHeight: 56 }}>
                  <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)', color: 'var(--t-2)' }}>
                    <i className={`${r.icon} text-lg`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{r.title[lang]}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{r.subtitle[lang]}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-500 flex-shrink-0">
                    {list.length} · {fmtSecs(totalSeconds(list))}
                  </span>
                  <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 space-y-3">
                    {list.map((m) => <Item key={m.id} m={m} idPrefix={`routine:${r.id}`} />)}
                    <button onClick={() => toggle(r.id)}
                      className={`mt-1 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold cursor-pointer transition-colors border ${
                        rDone
                          ? 'bg-green-500/12 border-green-500/35 text-green-300'
                          : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/25'}`}>
                      <i className={rDone ? 'ri-check-double-line' : 'ri-check-line'} />
                      {rDone ? t('mc_mob_done') : t('mc_mob_mark_done')}
                    </button>
                  </div>
                )}
                {!open && rDone && (
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
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5 pt-2">
        <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_mob_disclaimer')}
      </p>
    </div>
  );
}

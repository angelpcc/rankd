import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Fighter, Profile } from '@/lib/supabase';
import PhotoCard from '@/components/base/PhotoCard';

// Zona "Destacados" del directorio de peleadores: 3-4 perfiles a seguir en
// cards grandes con foto (PhotoCard). Criterio con datos reales: verificados y
// con mejor porcentaje de victorias primero, luego disponibles, más victorias
// y recién llegados. Se oculta si hay pocos candidatos o si el usuario está
// filtrando (entonces está buscando algo concreto, no descubriendo).

interface Item { fighter: Fighter; profile: Profile }

const disciplineKey: Record<string, string> = {
  boxing: 'disc_boxing', mma: 'disc_mma', kickboxing: 'disc_kickboxing',
  muay_thai: 'disc_muay_thai', wrestling: 'disc_wrestling', bjj: 'disc_bjj', other: 'disc_other',
};

function score(f: Fighter, i: number, newest: number): number {
  const fights = f.wins + f.losses + f.draws;
  const winRate = fights > 0 ? f.wins / fights : 0;
  const recency = newest > 0 ? 1 - i / newest : 0; // 0 primeros del array = más nuevos
  return (f.verified ? 100 : 0)
    + (f.is_available ? 25 : 0)
    + winRate * 40
    + Math.min(f.wins, 20)
    + recency * 8;
}

export default function FeaturedFighters({ items }: { items: Item[] }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const featured = useMemo(() => {
    if (items.length < 4) return [];
    return items
      .map((it, i) => ({ it, s: score(it.fighter, i, items.length) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map((x) => x.it);
  }, [items]);

  // Una etiqueta DISTINTA por card: cada peleador destaca en su propio eje
  // (verificado / mejor récord / pega fuerte / recién llegado). Evita 4 chips
  // iguales cuando el dataset es homogéneo.
  const reasons = useMemo(() => {
    const m = new Map<string, { label: string; cls: string }>();
    const rest = [...featured];
    const take = (pred: (f: Fighter) => boolean, pick: (a: Fighter, b: Fighter) => number, label: string, cls: string) => {
      const cands = rest.filter((x) => pred(x.fighter));
      if (!cands.length) return;
      const winner = cands.sort((a, b) => pick(a.fighter, b.fighter))[0];
      m.set(winner.fighter.id, { label, cls });
      rest.splice(rest.indexOf(winner), 1);
    };
    const wr = (f: Fighter) => { const n = f.wins + f.losses + f.draws; return n ? f.wins / n : 0; };
    take((f) => f.verified, (a, b) => wr(b) - wr(a), t('fd_reason_verified'), 'text-[#C9A84C] bg-[#C9A84C]/15 border-[#C9A84C]/35');
    take((f) => f.wins + f.losses + f.draws >= 3, (a, b) => wr(b) - wr(a), t('fd_reason_record'), 'text-red-300 bg-red-600/15 border-red-500/35');
    take((f) => f.kos >= 3, (a, b) => b.kos - a.kos, t('fd_reason_kos'), 'text-orange-300 bg-orange-500/15 border-orange-500/35');
    take(() => true, (a, b) => items.findIndex((x) => x.fighter.id === a.id) - items.findIndex((x) => x.fighter.id === b.id), t('fd_reason_new'), 'text-sky-300 bg-sky-500/15 border-sky-500/35');
    rest.forEach((x) => m.set(x.fighter.id, { label: t('fd_reason_top'), cls: 'text-zinc-300 bg-white/[0.06] border-white/15' }));
    return m;
  }, [featured, items, t]);

  if (featured.length < 3) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 pt-7">
      <div className="flex items-center gap-3 mb-3">
        <span className="rk-eyebrow">{t('fd_featured')}</span>
        <span style={{ flex: '0 0 28px', height: 1, background: 'rgba(255,255,255,0.14)' }} />
        <span className="text-xs text-zinc-500">{t('fd_featured_sub')}</span>
      </div>

      <div className="grid grid-flow-col auto-cols-[64%] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto sm:overflow-visible snap-x rk-noscroll-x -mx-1 px-1">
        {featured.map(({ fighter, profile }, idx) => {
          const r = reasons.get(fighter.id) || { label: t('fd_reason_top'), cls: 'text-zinc-300 bg-white/[0.06] border-white/15' };
          const disc = fighter.discipline ? t(disciplineKey[fighter.discipline] || fighter.discipline) : '';
          const rec = `${fighter.wins}-${fighter.losses}${fighter.draws ? `-${fighter.draws}` : ''}`;
          const subtitle = [disc, rec, fighter.kos ? `${fighter.kos} KO` : '']
            .filter(Boolean).join('  ·  ');
          return (
            <div key={fighter.id} className="snap-start anim-fade-up" style={{ animationDelay: `${Math.min(idx * 0.06, 0.3)}s` }}>
              <PhotoCard
                image={profile.avatar_url || undefined}
                objectPosition="center top"
                icon="ri-boxing-line"
                aspect="3 / 4"
                onClick={() => navigate(`/fighter/${fighter.id}`)}
                chips={
                  <>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${r.cls}`}>{r.label}</span>
                    {fighter.is_available && !fighter.verified && (
                      <span className="w-2 h-2 rounded-full bg-green-400 mt-1.5" aria-hidden />
                    )}
                  </>
                }
                title={(profile.full_name || t('fd_fighter_fallback')).toUpperCase()}
                subtitle={subtitle}
              />
            </div>
          );
        })}
      </div>
      <style>{`.rk-noscroll-x::-webkit-scrollbar{display:none}.rk-noscroll-x{scrollbar-width:none}`}</style>
    </div>
  );
}

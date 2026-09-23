import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Fighter, Profile } from '@/lib/supabase';
import { MOCK_FIGHTERS, MOCK_PROFILES } from '@/mocks/data';
import Reveal from '@/components/base/Reveal';
import SectionHead from '@/components/base/SectionHead';

interface FighterWithProfile { fighter: Fighter; profile: Profile; }

const disciplineLabels: Record<string, string> = { boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing', muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro' };
const disciplineColors: Record<string, string> = { boxing: '#E10600', mma: '#f97316', kickboxing: '#C9A84C', muay_thai: '#ef4444', wrestling: '#8b5cf6', bjj: '#3b82f6', other: '#6b7280' };

export default function Fighters() {
  const [active, setActive] = useState('Todos');
  const [data, setData] = useState<FighterWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const load = async () => {
      const toMock = () => MOCK_FIGHTERS
        .map((fi) => ({ fighter: fi, profile: MOCK_PROFILES.find((p) => p.id === fi.profile_id) as Profile }))
        .filter((i) => i.profile);
      try {
        const { data: fighters, error } = await supabase.from('fighters').select('*').eq('is_public', true).order('created_at', { ascending: false }).limit(12);
        if (error || !fighters || fighters.length === 0) { setData(toMock()); setLoading(false); return; }
        const { data: profiles, error: pe } = await supabase.from('profiles').select('*').in('id', fighters.map((f) => f.profile_id));
        if (pe || !profiles) { setData(toMock()); setLoading(false); return; }
        const pm = new Map(profiles.map((p) => [p.id, p]));
        const combined = fighters.map((f) => ({ fighter: f, profile: pm.get(f.profile_id) as Profile })).filter((i) => i.profile);
        setData(combined.length === 0 ? toMock() : combined);
      } catch {
        setData(toMock());
      }
      setLoading(false);
    };
    load();
  }, []);

  const disciplines = [
    { key: 'Todos', label: 'Todos' },
    { key: 'boxing', label: 'Boxeo' },
    { key: 'mma', label: 'MMA' },
    { key: 'kickboxing', label: 'Kickboxing' },
  ];
  // v4: cuatro, en una fila. Seis en dos filas de tres eran 1.300 px de fichas
  // en la portada; el directorio completo está a un clic.
  const filtered = active === 'Todos' ? data.slice(0, 4) : data.filter((d) => d.fighter.discipline === active).slice(0, 4);

  if (loading) {
    return (
      <section id="fighters" style={{ padding: 'var(--sp-section) 0', background: 'var(--rk-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #E10600', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </section>
    );
  }

  return (
    <section id="fighters" className="rk-viewport-section" style={{ position: 'relative', background: 'var(--rk-ink)', overflow: 'hidden' }}>
      {/* Ambiente */}
      <div className="rk-glow-red" style={{ top: '8%', right: '-12%', width: '55%', height: '60%' }} />
      <div className="rk-grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.3, maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)' }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1320, margin: '0 auto', padding: '0 24px' }}>

        {/* ── CABECERA ── */}
        <Reveal>
          <SectionHead eyebrow={t('fighters_eyebrow')} title={t('fighters_headline_1')} highlight={t('fighters_headline_2')}
            action={{ label: t('btn_view_full_directory'), onClick: () => navigate('/fighters') }} />
        </Reveal>

        {/* ── FILTROS ── */}
        <Reveal delay={70}>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 32, paddingBottom: 26, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {disciplines.map((d) => {
              const on = active === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => setActive(d.key)}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.82rem', fontWeight: 700,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    padding: '0.6rem 1.3rem', borderRadius: 100, cursor: 'pointer',
                    color: on ? '#fff' : 'var(--rk-text-3)',
                    background: on ? 'var(--rk-red)' : 'rgba(255,255,255,0.035)',
                    border: `1px solid ${on ? 'var(--rk-red)' : 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.3s var(--ease-out)',
                  }}
                  onMouseEnter={(e) => { if (!on) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; } }}
                  onMouseLeave={(e) => { if (!on) { e.currentTarget.style.color = 'var(--rk-text-3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; } }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* ── FICHAS ── */}
        {filtered.length === 0 ? (
          <Reveal>
            <div style={{ textAlign: 'center', padding: '70px 0' }}>
              <i className="ri-user-search-line" style={{ fontSize: 42, color: 'rgba(255,255,255,0.16)' }} />
              <p className="rk-body" style={{ marginTop: 14 }}>{t('fighters_empty_discipline')}</p>
            </div>
          </Reveal>
        ) : (
          <div className="ftr-grid rk-carrusel-m" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {filtered.map(({ fighter, profile }, i) => {
              const color = disciplineColors[fighter.discipline || 'other'] || '#6b7280';
              const initials = (profile.full_name || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              const total = fighter.wins + fighter.losses + fighter.draws;
              const rate = total > 0 ? Math.round((fighter.wins / total) * 100) : null;
              return (
                <Reveal key={fighter.id} delay={i * 90} variant="scale">
                  <article
                    onClick={() => navigate(`/fighter/${fighter.id}`)}
                    className="rk-card"
                    style={{ overflow: 'hidden', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    {/* Retrato */}
                    <div className="rk-img-wrap rk-img-treat" style={{ position: 'relative', height: 268, background: 'linear-gradient(160deg, #141414, #0a0a0a)', overflow: 'hidden' }}>
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.full_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 76, color: 'rgba(255,255,255,0.07)' }}>{initials}</span>
                        </div>
                      )}

                      {/* Disciplina */}
                      {fighter.discipline && (
                        <span style={{ position: 'absolute', top: 13, left: 13, zIndex: 3, fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', background: color, padding: '0.3rem 0.7rem', borderRadius: 5 }}>
                          {disciplineLabels[fighter.discipline]}
                        </span>
                      )}

                      {/* Disponibilidad */}
                      <span style={{ position: 'absolute', top: 13, right: 13, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem', letterSpacing: '0.1em', color: fighter.is_available ? '#4ade80' : 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: '0.3rem 0.65rem', borderRadius: 100, border: `1px solid ${fighter.is_available ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.12)'}` }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: fighter.is_available ? '#4ade80' : 'rgba(255,255,255,0.4)' }} />
                          {fighter.is_available ? t('fighters_home_available') : t('fighters_home_not_available')}
                      </span>

                      {/* Nombre sobre la foto */}
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3, padding: '0 17px 15px' }}>
                        <h3 className="rk-h3" style={{ margin: 0, color: '#fff', fontSize: '1.42rem', textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>
                          {profile.full_name || 'Peleador'}
                        </h3>
                        {fighter.nickname && (
                          <p style={{ margin: '3px 0 0', fontFamily: "'Barlow Condensed', sans-serif", fontStyle: 'italic', fontSize: '0.86rem', color: color, textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>
                            «{fighter.nickname}»
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Datos */}
                    <div style={{ padding: '15px 17px 17px', display: 'flex', flexDirection: 'column', gap: 13, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span className="rk-body" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                          <i className="ri-map-pin-line" style={{ opacity: 0.5 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fighter.nationality || profile.location || '—'}
                          </span>
                        </span>
                        {rate !== null && (
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '0.08em', color: 'var(--rk-gold)', flexShrink: 0 }}>
                            {rate}% VICTORIAS
                          </span>
                        )}
                      </div>

                      {/* Récord */}
                      <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, gap: 0 }}>
                        {[
                          { v: fighter.wins, l: t('fighters_wins'), c: '#4ade80' },
                          { v: fighter.losses, l: t('fighters_losses'), c: '#f87171' },
                          { v: fighter.draws, l: 'Emp', c: '#fbbf24' },
                          { v: fighter.kos, l: 'KO', c: '#fb923c' },
                        ].map((s, idx) => (
                          <div key={s.l} style={{ flex: 1, textAlign: 'center', borderLeft: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', lineHeight: 1, color: s.c }}>{s.v}</div>
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rk-text-3)', marginTop: 3 }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1024px) { .ftr-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 720px) {
          .ftr-head { grid-template-columns: 1fr !important; align-items: start !important; }
          .ftr-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
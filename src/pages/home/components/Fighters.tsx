import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Fighter, Profile } from '@/lib/supabase';
import { MOCK_FIGHTERS, MOCK_PROFILES } from '@/mocks/data';

interface FighterWithProfile {
  fighter: Fighter;
  profile: Profile;
}

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};

const disciplineColors: Record<string, string> = {
  boxing: '#E10600', mma: '#f97316', kickboxing: '#eab308',
  muay_thai: '#ef4444', wrestling: '#8b5cf6', bjj: '#3b82f6', other: '#6b7280',
};

export default function Fighters() {
  const [active, setActive] = useState('Todos');
  const [data, setData] = useState<FighterWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const load = async () => {
      try {
        const { data: fighters, error } = await supabase
          .from('fighters').select('*').eq('is_public', true)
          .order('created_at', { ascending: false }).limit(12);

        const useMock = (f?: Fighter[] | null) => {
          const mock = MOCK_FIGHTERS.map((fi) => ({
            fighter: fi,
            profile: MOCK_PROFILES.find((p) => p.id === fi.profile_id) as Profile,
          })).filter((i) => i.profile);
          setData(mock);
          setLoading(false);
        };

        if (error || !fighters || fighters.length === 0) { useMock(); return; }

        const profileIds = fighters.map((f) => f.profile_id);
        const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', profileIds);
        if (profilesError || !profiles) { useMock(); return; }

        const profileMap = new Map(profiles.map((p) => [p.id, p]));
        const combined = fighters.map((f) => ({ fighter: f, profile: profileMap.get(f.profile_id) as Profile })).filter((i) => i.profile);
        setData(combined.length === 0 ? MOCK_FIGHTERS.map((fi) => ({ fighter: fi, profile: MOCK_PROFILES.find((p) => p.id === fi.profile_id) as Profile })).filter((i) => i.profile) : combined);
        setLoading(false);
      } catch {
        setData(MOCK_FIGHTERS.map((f) => ({ fighter: f, profile: MOCK_PROFILES.find((p) => p.id === f.profile_id) as Profile })).filter((i) => i.profile));
        setLoading(false);
      }
    };
    load();
  }, []);

  const disciplines = [
    { key: 'Todos', labelKey: 'fighters_filter_all' },
    { key: 'boxing', label: 'Boxeo' },
    { key: 'mma', label: 'MMA' },
    { key: 'kickboxing', label: 'Kickboxing' },
  ];

  const filtered = active === 'Todos' ? data.slice(0, 6) : data.filter((d) => d.fighter.discipline === active).slice(0, 6);

  if (loading) {
    return (
      <section id="fighters" className="py-24 md:py-32 bg-[#080808]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section id="fighters" className="py-24 md:py-32 bg-[#080808] relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.04) 0%, transparent 65%)' }} />

      <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-14">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-6 h-px bg-[#E10600]" />
              <span className="text-[#E10600] text-xs font-semibold tracking-[0.2em] uppercase font-inter">
                {t('fighters_eyebrow')}
              </span>
            </div>
            <h2 className="font-unbounded font-black text-white leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
              {t('fighters_headline_1')}<br />
              <span className="font-light text-white/20">{t('fighters_headline_2')}</span>
            </h2>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-1 p-1 rounded-full self-start lg:self-auto"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {disciplines.map((d) => (
              <button key={d.key} onClick={() => setActive(d.key)}
                className="px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap font-inter"
                style={{
                  background: active === d.key ? '#E10600' : 'transparent',
                  color: active === d.key ? 'white' : 'rgba(255,255,255,0.35)',
                  boxShadow: active === d.key ? '0 0 20px rgba(225,6,0,0.3)' : 'none',
                }}>
                {d.labelKey ? t(d.labelKey) : d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de cards */}
        {data.length === 0 ? (
          <div className="rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl mb-5"
              style={{ background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.15)' }}>
              <i className="ri-user-line text-2xl text-[#E10600]" />
            </div>
            <h3 className="font-unbounded font-bold text-white text-sm mb-3">{t('fighters_home_empty_title')}</h3>
            <p className="text-white/25 text-sm font-inter leading-relaxed max-w-sm mb-8">{t('fighters_home_empty_desc')}</p>
            <button onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-2 bg-[#E10600] text-white font-semibold text-sm px-6 py-3 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter">
              <i className="ri-user-add-line" /> {t('fighters_home_create_profile')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/25 text-sm font-inter">{t('fighters_home_no_discipline')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(({ fighter, profile }) => {
              const initials = (profile.full_name || 'F').split(' ').slice(0, 2).map((w: string) => w[0]).join('');
              const discipline = fighter.discipline || '';
              const disciplineLabel = disciplineLabels[discipline] || discipline;
              const accentColor = disciplineColors[discipline] || '#E10600';

              return (
                <div key={fighter.id}
                  className="group rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
                  style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)' }}
                  onClick={() => navigate(`/fighter/${fighter.id}`)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
                >
                  {/* Barra de color disciplina */}
                  <div className="h-[2px] w-full" style={{ background: accentColor }} />

                  {/* Avatar area */}
                  <div className="relative h-52 overflow-hidden flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.full_name || 'Fighter'} className="w-full h-full object-cover object-top" />
                    ) : (
                      <span className="font-unbounded font-black select-none" style={{ fontSize: 'clamp(4rem, 10vw, 6rem)', color: 'rgba(255,255,255,0.06)' }}>
                        {initials}
                      </span>
                    )}

                    {/* Gradiente inferior sobre foto */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-transparent opacity-80" />

                    {/* Disciplina badge */}
                    {discipline && (
                      <div className="absolute top-4 left-4">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-inter"
                          style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40`, color: accentColor }}>
                          {disciplineLabel}
                        </div>
                      </div>
                    )}

                    {/* Disponibilidad */}
                    <div className="absolute top-4 right-4">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-inter border ${fighter.is_available ? 'text-emerald-400 border-emerald-500/25' : 'text-amber-400 border-amber-500/25'}`}
                        style={{ background: fighter.is_available ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }}>
                        <div className={`w-1.5 h-1.5 rounded-full ${fighter.is_available ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                        {fighter.is_available ? t('fighters_home_available') : t('fighters_home_not_available')}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-white font-unbounded font-bold text-sm leading-snug group-hover:text-[#E10600] transition-colors">
                        {profile.full_name || 'Peleador'}
                      </h3>
                      {fighter.nationality && (
                        <span className="text-white/30 text-xs font-inter flex-shrink-0 mt-0.5">{fighter.nationality}</span>
                      )}
                    </div>
                    {fighter.nickname && (
                      <p className="text-white/25 text-xs font-inter italic mb-1">&ldquo;{fighter.nickname}&rdquo;</p>
                    )}
                    {(fighter.age || profile.location) && (
                      <p className="text-white/25 text-xs font-inter mb-4">
                        {profile.location}{profile.location && fighter.age ? ' · ' : ''}{fighter.age ? `${fighter.age} años` : ''}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { val: fighter.wins, label: t('fighters_wins') },
                        { val: fighter.losses, label: t('fighters_losses') },
                        { val: fighter.weight_class || '-', label: t('fighters_category') },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl p-2.5 text-center"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="text-white font-bold text-sm font-inter">{stat.val}</div>
                          <div className="text-white/20 text-xs font-inter mt-0.5">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Footer card */}
                    <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-white/25 text-xs font-inter truncate">{fighter.gym || ''}</span>
                      <div className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-all duration-200"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = '#E10600'; el.style.borderColor = '#E10600'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = 'rgba(255,255,255,0.05)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
                        <i className="ri-arrow-right-up-line text-white text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ver todos */}
        {data.length > 0 && (
          <div className="mt-12 text-center">
            <button onClick={() => navigate('/fighters')}
              className="inline-flex items-center gap-3 border border-white/10 text-white/40 font-semibold px-8 py-4 rounded-full hover:border-[#E10600] hover:text-[#E10600] transition-colors cursor-pointer whitespace-nowrap font-inter">
              {t('btn_view_full_directory')} <i className="ri-arrow-right-line" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

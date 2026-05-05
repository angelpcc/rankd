import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Fighter, Profile } from '@/lib/supabase';
import { MOCK_FIGHTERS, MOCK_PROFILES } from '@/mocks/data';

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
      try {
        const { data: fighters, error } = await supabase.from('fighters').select('*').eq('is_public', true).order('created_at', { ascending: false }).limit(12);
        const useMock = () => { setData(MOCK_FIGHTERS.map((fi) => ({ fighter: fi, profile: MOCK_PROFILES.find((p) => p.id === fi.profile_id) as Profile })).filter((i) => i.profile)); setLoading(false); };
        if (error || !fighters || fighters.length === 0) { useMock(); return; }
        const { data: profiles, error: pe } = await supabase.from('profiles').select('*').in('id', fighters.map((f) => f.profile_id));
        if (pe || !profiles) { useMock(); return; }
        const pm = new Map(profiles.map((p) => [p.id, p]));
        const combined = fighters.map((f) => ({ fighter: f, profile: pm.get(f.profile_id) as Profile })).filter((i) => i.profile);
        setData(combined.length === 0 ? MOCK_FIGHTERS.map((fi) => ({ fighter: fi, profile: MOCK_PROFILES.find((p) => p.id === fi.profile_id) as Profile })).filter((i) => i.profile) : combined);
        setLoading(false);
      } catch { setData(MOCK_FIGHTERS.map((f) => ({ fighter: f, profile: MOCK_PROFILES.find((p) => p.id === f.profile_id) as Profile })).filter((i) => i.profile)); setLoading(false); }
    };
    load();
  }, []);

  const disciplines = [{ key: 'Todos', labelKey: 'fighters_filter_all' }, { key: 'boxing', label: 'Boxeo' }, { key: 'mma', label: 'MMA' }, { key: 'kickboxing', label: 'Kickboxing' }];
  const filtered = active === 'Todos' ? data.slice(0, 6) : data.filter((d) => d.fighter.discipline === active).slice(0, 6);

  if (loading) return <section id="fighters" style={{ padding: '120px 0', background: '#070707', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 32, height: 32, border: '2px solid #E10600', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></section>;

  return (
    <section id="fighters" style={{ padding: '120px 0', background: '#070707', position: 'relative', overflow: 'hidden' }}>
      {/* BG sutil */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <img src="https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=1920&q=80&fit=crop" alt="Boxing gloves" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.06 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', background: 'radial-gradient(ellipse at right, rgba(225,6,0,0.07) 0%, transparent 65%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 3, background: '#E10600', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#E10600' }}>{t('fighters_eyebrow')}</span>
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 6vw, 88px)', lineHeight: 0.9, color: 'white', margin: 0 }}>
              {t('fighters_headline_1')}<br /><span style={{ color: 'rgba(255,255,255,0.15)' }}>{t('fighters_headline_2')}</span>
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 5 }}>
            {disciplines.map((d) => (
              <button key={d.key} onClick={() => setActive(d.key)} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2, padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: active === d.key ? '#E10600' : 'transparent', color: active === d.key ? 'white' : 'rgba(255,255,255,0.35)', boxShadow: active === d.key ? '0 4px 20px rgba(225,6,0,0.35)' : 'none' }}>
                {d.labelKey ? t(d.labelKey) : d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? <div style={{ textAlign: 'center', padding: '60px 0' }}><p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>{t('fighters_home_no_discipline')}</p></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }} className="fighters-grid">
            {filtered.map(({ fighter, profile }) => {
              const initials = (profile.full_name || 'F').split(' ').slice(0, 2).map((w: string) => w[0]).join('');
              const discipline = fighter.discipline || '';
              const accentColor = disciplineColors[discipline] || '#E10600';
              return (
                <div key={fighter.id} onClick={() => navigate(`/fighter/${fighter.id}`)} style={{ borderRadius: 20, overflow: 'hidden', cursor: 'pointer', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.3s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 24px 60px ${accentColor}20`; (e.currentTarget as HTMLDivElement).style.borderColor = `${accentColor}40`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                  <div style={{ height: 3, background: `linear-gradient(to right, ${accentColor}, transparent)` }} />
                  <div style={{ height: 220, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                    {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} /> : <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, color: 'rgba(255,255,255,0.04)' }}>{initials}</span>}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0d0d0d 0%, transparent 55%)' }} />
                    {discipline && <div style={{ position: 'absolute', top: 14, left: 14, fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, color: accentColor, background: `${accentColor}18`, border: `1px solid ${accentColor}35`, borderRadius: 8, padding: '5px 12px' }}>{disciplineLabels[discipline]}</div>}
                    <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 600, color: fighter.is_available ? '#22c55e' : '#f59e0b', background: fighter.is_available ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${fighter.is_available ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '5px 10px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: fighter.is_available ? '#22c55e' : '#f59e0b' }} />
                      {fighter.is_available ? t('fighters_home_available') : t('fighters_home_not_available')}
                    </div>
                  </div>
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'white', margin: 0, lineHeight: 1 }}>{profile.full_name || 'Peleador'}</h3>
                      {fighter.nationality && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>{fighter.nationality}</span>}
                    </div>
                    {fighter.nickname && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: 16 }}>&ldquo;{fighter.nickname}&rdquo;</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                      {[{ val: fighter.wins, label: t('fighters_wins') }, { val: fighter.losses, label: t('fighters_losses') }, { val: fighter.weight_class || '-', label: t('fighters_category') }].map((s) => (
                        <div key={s.label} style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'white', lineHeight: 1 }}>{s.val}</div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>{fighter.gym || ''}</span>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1, color: accentColor }}>VER PERFIL →</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <button onClick={() => navigate('/fighters')} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', background: 'transparent', border: '2px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 40px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#E10600'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E10600'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(225,6,0,0.2)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}>
            {t('btn_view_full_directory')} →
          </button>
        </div>
      </div>
      <style>{`@media(max-width:900px){.fighters-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}

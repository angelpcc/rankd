import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Organization, Profile } from '@/lib/supabase';
import { MOCK_ORGANIZATIONS, MOCK_ORG_PROFILES } from '@/mocks/data';

interface OrgWithProfile { org: Organization; profile: Profile | null; }

export default function Partners() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrgWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); }),
      { threshold: 0.08 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: orgsData, error } = await supabase.from('organizations').select('*').eq('is_public', true).order('created_at', { ascending: false }).limit(8);
        const applyMock = () => { setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null }))); setLoading(false); };
        if (error || !orgsData || orgsData.length === 0) { applyMock(); return; }
        const { data: profiles, error: pe } = await supabase.from('profiles').select('*').in('id', orgsData.map(o => o.profile_id));
        if (pe) { applyMock(); return; }
        const pm = new Map(profiles?.map((p) => [p.id, p]) || []);
        const combined = orgsData.map((org) => ({ org, profile: pm.get(org.profile_id) || null }));
        setOrgs(combined.length === 0 ? MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null })) : combined);
        setLoading(false);
      } catch { setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null }))); setLoading(false); }
    };
    load();
  }, []);

  const typeKeyMap: Record<string, string> = { promoter: 'partners_type_promoter', gym: 'partners_type_gym', manager: 'partners_type_manager', brand: 'partners_type_brand', organizer: 'partners_type_organizer' };

  // R12-T10: beneficios por función (qué te da RANKD), en vez de tarjetas por
  // rol —eso ya lo cuenta "Cómo funciona"—. Escaneable y muy visual.
  const benefits = [
    { icon: 'ri-boxing-line', accent: '#E10600', href: '/esquina', t: 'ben_corner_t', d: 'ben_corner_d' },
    { icon: 'ri-links-line', accent: '#E10600', href: '/opportunities', t: 'ben_connect_t', d: 'ben_connect_d' },
    { icon: 'ri-calendar-event-line', accent: '#C9A84C', href: '/eventos', t: 'ben_events_t', d: 'ben_events_d' },
    { icon: 'ri-store-2-line', accent: '#C9A84C', href: '/brands', t: 'ben_brands_t', d: 'ben_brands_d' },
    { icon: 'ri-newspaper-line', accent: '#ffffff', href: '/noticias', t: 'ben_news_t', d: 'ben_news_d' },
  ];

  return (
    <section id="partners" ref={sectionRef} style={{ background: '#050505', position: 'relative', overflow: 'hidden' }}>

      {/* ═══ BENEFICIOS ═══ */}
      <div style={{ padding: '88px 0 80px' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px' }}>

          {/* Header */}
          <div className="reveal" style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 3, background: '#E10600', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#E10600' }}>{t('ben_eyebrow')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 7vw, 96px)', lineHeight: 0.9, color: 'white', margin: 0 }}>
                {t('ben_headline_1')} <span style={{ color: '#C9A84C', textShadow: '0 0 40px rgba(201,168,76,0.25)' }}>{t('ben_headline_2')}</span>
              </h2>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.78)', maxWidth: 400, lineHeight: 1.55 }}>{t('ben_subtext')}</p>
            </div>
          </div>

          {/* Tarjetas de beneficio — escaneables */}
          <div className="ben-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {benefits.map((b, i) => (
              <a key={b.t} href={b.href} onClick={(e) => { e.preventDefault(); navigate(b.href); }}
                className={`reveal reveal-delay-${Math.min(i + 1, 4)} rk-card group`}
                style={{ display: 'flex', flexDirection: 'column', padding: '26px 24px', borderRadius: 18, textDecoration: 'none', cursor: 'pointer', height: '100%', position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: 0, left: 0, width: '38%', height: 3, background: b.accent }} />
                <div style={{ width: 48, height: 48, borderRadius: 13, background: `${b.accent}16`, border: `1px solid ${b.accent}3a`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <i className={b.icon} style={{ color: b.accent, fontSize: 23 }} />
                </div>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 27, letterSpacing: 1, color: '#fff', margin: '0 0 8px', lineHeight: 1 }}>{t(b.t)}</h3>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, margin: 0, flex: 1 }}>{t(b.d)}</p>
                <span className="group-hover:gap-2" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: b.accent === '#ffffff' ? 'rgba(255,255,255,0.85)' : b.accent }}>
                  {t('ben_explore')} <i className="ri-arrow-right-line" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ CTA ═══ */}
      <div style={{ position: 'relative', overflow: 'hidden', background: '#080808', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -100, left: -100, width: 600, height: 600, background: 'radial-gradient(circle, rgba(225,6,0,0.07) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', bottom: -100, right: -100, width: 500, height: 500, background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 65%)' }} />
        </div>
        <div className="reveal partners-cta" style={{ position: 'relative', zIndex: 1, maxWidth: 1300, margin: '0 auto', padding: 'clamp(64px, 9vw, 100px) 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 3, background: '#E10600', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#E10600' }}>{t('partners_cta_eyebrow')}</span>
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 6vw, 90px)', color: 'white', margin: '0 0 16px', lineHeight: 0.88 }}>
              {t('partners_cta_headline_1')}<br />
              <span style={{ color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.15)' }}>{t('partners_cta_headline_2')}</span>
            </h3>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, color: 'rgba(255,255,255,0.78)', maxWidth: 500, lineHeight: 1.5, margin: 0 }}>{t('partners_cta_desc')}</p>
          </div>
          <div className="partners-cta-actions" style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start', flexShrink: 0, maxWidth: '100%' }}>
            <a href="/auth" className="btn-glow" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 4, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 14, padding: '20px 52px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block', textAlign: 'center', transition: 'all 0.25s', whiteSpace: 'nowrap', maxWidth: '100%', boxSizing: 'border-box' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-4px) scale(1.02)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; }}>
              {t('partners_cta_btn')} →
            </a>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.75)', letterSpacing: 2 }}>{t('partners_cta_note')}</span>
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:960px){ .ben-grid{ grid-template-columns:repeat(2,1fr)!important } }
        @media(max-width:560px){ .ben-grid{ grid-template-columns:1fr!important } }
        @media(max-width:720px){
          .partners-cta{ flex-direction:column; align-items:flex-start!important; gap:36px!important }
          .partners-cta-actions{ width:100%; align-items:stretch!important }
          .partners-cta-actions a{ width:100% }
          .partners-cta-actions span{ text-align:center }
        }
      `}</style>
    </section>
  );
}
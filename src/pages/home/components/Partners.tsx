import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Organization, Profile } from '@/lib/supabase';
import { MOCK_ORGANIZATIONS, MOCK_ORG_PROFILES } from '@/mocks/data';

interface OrgWithProfile { org: Organization; profile: Profile | null; }

export default function Partners() {
  const { t } = useTranslation();
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
        const useMock = () => { setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null }))); setLoading(false); };
        if (error || !orgsData || orgsData.length === 0) { useMock(); return; }
        const { data: profiles, error: pe } = await supabase.from('profiles').select('*').in('id', orgsData.map(o => o.profile_id));
        if (pe) { useMock(); return; }
        const pm = new Map(profiles?.map((p) => [p.id, p]) || []);
        const combined = orgsData.map((org) => ({ org, profile: pm.get(org.profile_id) || null }));
        setOrgs(combined.length === 0 ? MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null })) : combined);
        setLoading(false);
      } catch { setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null }))); setLoading(false); }
    };
    load();
  }, []);

  const typeKeyMap: Record<string, string> = { promoter: 'partners_type_promoter', gym: 'partners_type_gym', manager: 'partners_type_manager', brand: 'partners_type_brand', organizer: 'partners_type_organizer' };

  const whyCards = [
    {
      roleKey: 'partners_role_fighters', accent: '#E10600', icon: 'ri-boxing-line',
      img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/Peleadores.png',
      points: ['partners_fighters_p1', 'partners_fighters_p2', 'partners_fighters_p3', 'partners_fighters_p4']
    },
    {
      roleKey: 'partners_role_promoters', accent: '#C9A84C', icon: 'ri-trophy-line',
      img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/Promotoras%20y%20clubes.png',
      points: ['partners_promoters_p1', 'partners_promoters_p2', 'partners_promoters_p3', 'partners_promoters_p4']
    },
    {
      roleKey: 'partners_role_brands', accent: '#ffffff', icon: 'ri-megaphone-line',
      img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/Marcas%20y%20patrocinadores.png',
      points: ['partners_brands_p1', 'partners_brands_p2', 'partners_brands_p3', 'partners_brands_p4']
    },
  ];

  return (
    <section id="partners" ref={sectionRef} style={{ background: '#050505', position: 'relative', overflow: 'hidden' }}>

      {/* ═══ PARA QUIÉN ═══ */}
      <div style={{ padding: '88px 0 80px' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 48px' }}>

          {/* Header */}
          <div className="reveal" style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 3, background: '#E10600', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#E10600' }}>{t('partners_why_eyebrow')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(60px, 8vw, 110px)', lineHeight: 0.88, color: 'white', margin: 0 }}>
                {t('partners_why_headline_1')}<br /><span style={{ color: '#C9A84C', textShadow: '0 0 40px rgba(201,168,76,0.25)' }}>{t('partners_why_headline_2')}</span>
              </h2>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.78)', maxWidth: 400, lineHeight: 1.55 }}>{t('partners_subtext')}</p>
            </div>
          </div>

          {/* Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="why-grid">
            {whyCards.map((card, i) => (
              <div key={card.roleKey}
                className={`reveal reveal-delay-${i + 1}`}
                style={{ borderRadius: 24, overflow: 'hidden', position: 'relative', minHeight: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)', cursor: 'default', border: `1px solid ${card.accent}15` }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-8px)'; const img = (e.currentTarget as HTMLDivElement).querySelector('.card-img') as HTMLImageElement; if (img) img.style.transform = 'scale(1.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; const img = (e.currentTarget as HTMLDivElement).querySelector('.card-img') as HTMLImageElement; if (img) img.style.transform = 'scale(1)'; }}>
                <img className="card-img" src={card.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', transition: 'transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg, rgba(5,5,5,0.98) 0%, rgba(5,5,5,0.65) 45%, rgba(5,5,5,0.1) 100%)` }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: card.accent }} />
                <div style={{ position: 'absolute', top: 20, right: 20, padding: '6px 14px', borderRadius: 100, background: `${card.accent}18`, border: `1px solid ${card.accent}35`, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: card.accent }}>
                  <i className={card.icon} style={{ marginRight: 6 }} />{t(card.roleKey).split(' ')[0]}
                </div>
                <div style={{ position: 'relative', zIndex: 1, padding: '0 30px 32px' }}>
                  <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: 'white', marginBottom: 18, lineHeight: 1 }}>{t(card.roleKey)}</h4>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {card.points.map((pk) => (
                      <li key={pk} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}>
                        <i className="ri-check-line" style={{ color: card.accent, flexShrink: 0, marginTop: 2, fontSize: 14 }} />
                        {t(pk)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
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
        <div className="reveal" style={{ position: 'relative', zIndex: 1, maxWidth: 1300, margin: '0 auto', padding: '72px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 60, flexWrap: 'wrap' }} className-cta="cta-inner">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 32, height: 3, background: '#E10600', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#E10600' }}>{t('partners_cta_eyebrow')}</span>
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 6vw, 90px)', color: 'white', margin: '0 0 16px', lineHeight: 0.88 }}>
              {t('partners_cta_headline_1')}<br />
              <span style={{ color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.15)' }}>{t('partners_cta_headline_2')}</span>
            </h3>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, color: 'rgba(255,255,255,0.78)', maxWidth: 500, lineHeight: 1.5 }}>{t('partners_cta_desc')}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start', flexShrink: 0 }}>
            <a href="/auth" className="btn-glow" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 4, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', borderRadius: 14, padding: '20px 52px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block', transition: 'all 0.25s', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-4px) scale(1.02)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; }}>
              {t('partners_cta_btn')} →
            </a>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.75)', letterSpacing: 2 }}>Sin tarjeta · Totalmente gratis</span>
          </div>
        </div>
      </div>

      <style>{`@media(max-width:960px){.why-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}
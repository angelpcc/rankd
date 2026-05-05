import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Organization, Profile } from '@/lib/supabase';
import { MOCK_ORGANIZATIONS, MOCK_ORG_PROFILES } from '@/mocks/data';

interface OrgWithProfile { org: Organization; profile: Profile | null; }

export default function Partners() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<OrgWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: orgsData, error } = await supabase.from('organizations').select('*').eq('is_public', true).order('created_at', { ascending: false }).limit(8);
        const useMock = () => { setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null }))); setLoading(false); };
        if (error || !orgsData || orgsData.length === 0) { useMock(); return; }
        const profileIds = orgsData.map((o) => o.profile_id);
        const { data: profiles, error: pe } = await supabase.from('profiles').select('*').in('id', profileIds);
        if (pe) { useMock(); return; }
        const pm = new Map(profiles?.map((p) => [p.id, p]) || []);
        const combined = orgsData.map((org) => ({ org, profile: pm.get(org.profile_id) || null }));
        setOrgs(combined.length === 0 ? MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null })) : combined);
        setLoading(false);
      } catch { setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null }))); setLoading(false); }
    };
    load();
  }, []);

  const whyCards = [
    { icon: 'ri-boxing-line', roleKey: 'partners_role_fighters', accent: '#E10600', points: ['partners_fighters_p1', 'partners_fighters_p2', 'partners_fighters_p3', 'partners_fighters_p4'] },
    { icon: 'ri-trophy-line', roleKey: 'partners_role_promoters', accent: '#C9A84C', points: ['partners_promoters_p1', 'partners_promoters_p2', 'partners_promoters_p3', 'partners_promoters_p4'] },
    { icon: 'ri-store-2-line', roleKey: 'partners_role_brands', accent: 'rgba(255,255,255,0.5)', points: ['partners_brands_p1', 'partners_brands_p2', 'partners_brands_p3', 'partners_brands_p4'] },
  ];

  const typeKeyMap: Record<string, string> = { promoter: 'partners_type_promoter', gym: 'partners_type_gym', manager: 'partners_type_manager', brand: 'partners_type_brand', organizer: 'partners_type_organizer' };

  return (
    <section id="partners" style={{ padding: '120px 0', background: '#080808', position: 'relative', overflow: 'hidden' }}>
      {/* BG imagen kickboxing */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', zIndex: 0 }}>
        <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1920&q=80&fit=crop" alt="Kickboxing" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.05 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, #080808)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '0 40px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 32, height: 1, background: 'rgba(201,168,76,0.5)' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C' }}>{t('partners_eyebrow')}</span>
            <div style={{ width: 32, height: 1, background: 'rgba(201,168,76,0.5)' }} />
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 5vw, 80px)', color: 'white', margin: '0 0 16px', lineHeight: 0.95 }}>{t('partners_headline')}</h2>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.3)', maxWidth: 500, margin: '0 auto' }}>{t('partners_subtext')}</p>
        </div>

        {/* Orgs Grid */}
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div style={{ width: 28, height: 28, border: '2px solid #C9A84C', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div> : orgs.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 80 }} className="orgs-grid">
            {orgs.map(({ org, profile }) => {
              const initials = (org.org_name || profile?.full_name || 'O').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={org.id} style={{ borderRadius: 14, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.25s', cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.25)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'white' }}>
                    {org.logo_url ? <img src={org.logo_url} alt={org.org_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4, borderRadius: 12 }} /> : initials}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: 'white' }}>{org.org_name || profile?.full_name}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{t(typeKeyMap[org.org_type || ''] || 'partners_type_organizer')}</div>
                  </div>
                </div>
              );
            })}
            {orgs.length < 4 && Array.from({ length: 4 - orgs.length }).map((_, i) => (
              <div key={i} style={{ borderRadius: 14, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', minHeight: 110 }}>
                <i className="ri-add-line" style={{ color: 'rgba(255,255,255,0.1)', fontSize: 20 }} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.1)', letterSpacing: 2 }}>{t('label_coming_soon')}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Why Rankd */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48, flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 28, height: 2, background: '#C9A84C' }} />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C' }}>{t('partners_why_eyebrow')}</span>
              </div>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px, 4vw, 68px)', color: 'white', margin: 0, lineHeight: 0.95 }}>
                {t('partners_why_headline_1')}<br /><span style={{ color: 'rgba(255,255,255,0.12)' }}>{t('partners_why_headline_2')}</span>
              </h3>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="why-grid">
            {whyCards.map((card) => (
              <div key={card.roleKey} style={{ borderRadius: 16, padding: '36px 32px', background: 'rgba(255,255,255,0.025)', border: `1px solid rgba(255,255,255,0.06)`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: card.accent, opacity: 0.5 }} />
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${card.accent}15`, border: `1px solid ${card.accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <i className={`${card.icon}`} style={{ color: card.accent, fontSize: 22 }} />
                </div>
                <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: 'white', marginBottom: 20, lineHeight: 1 }}>{t(card.roleKey)}</h4>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {card.points.map((pk) => (
                    <li key={pk} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                      <i className="ri-check-line" style={{ color: card.accent, flexShrink: 0, marginTop: 2, fontSize: 14 }} />
                      {t(pk)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div style={{ borderRadius: 20, padding: '60px 64px', background: 'linear-gradient(135deg, rgba(225,6,0,0.08) 0%, rgba(201,168,76,0.05) 100%)', border: '1px solid rgba(225,6,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 40, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }} className="cta-banner">
          <div style={{ position: 'absolute', right: -40, top: -40, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,6,0,0.1) 0%, transparent 70%)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 24, height: 2, background: '#E10600' }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#E10600' }}>{t('partners_cta_eyebrow')}</span>
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 4vw, 60px)', color: 'white', margin: '0 0 12px', lineHeight: 0.95 }}>
              {t('partners_cta_headline_1')}<br /><span style={{ color: 'rgba(255,255,255,0.2)' }}>{t('partners_cta_headline_2')}</span>
            </h3>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, color: 'rgba(255,255,255,0.35)', maxWidth: 480 }}>{t('partners_cta_desc')}</p>
          </div>
          <a href="/auth" style={{ position: 'relative', zIndex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'white', background: '#E10600', border: 'none', borderRadius: 10, padding: '18px 44px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block', boxShadow: '0 0 40px rgba(225,6,0,0.3)', transition: 'all 0.2s', whiteSpace: 'nowrap' }} onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'} onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.transform = 'none'}>
            {t('partners_cta_btn')} →
          </a>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @media(max-width:900px){.orgs-grid{grid-template-columns:repeat(2,1fr)!important}.why-grid{grid-template-columns:1fr!important}.cta-banner{padding:40px 28px!important}}`}</style>
    </section>
  );
}

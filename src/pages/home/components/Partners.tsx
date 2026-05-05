import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Organization, Profile } from '@/lib/supabase';
import { MOCK_ORGANIZATIONS, MOCK_ORG_PROFILES } from '@/mocks/data';

interface OrgWithProfile {
  org: Organization;
  profile: Profile | null;
}

export default function Partners() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<OrgWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: orgsData, error } = await supabase
          .from('organizations').select('*').eq('is_public', true)
          .order('created_at', { ascending: false }).limit(8);
        if (error || !orgsData || orgsData.length === 0) {
          setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null })));
          setLoading(false); return;
        }
        const profileIds = orgsData.map((o) => o.profile_id);
        const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', profileIds);
        if (profilesError) {
          setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null })));
          setLoading(false); return;
        }
        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        const combined = orgsData.map((org) => ({ org, profile: profileMap.get(org.profile_id) || null }));
        setOrgs(combined.length === 0 ? MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null })) : combined);
        setLoading(false);
      } catch {
        setOrgs(MOCK_ORGANIZATIONS.map((org) => ({ org, profile: MOCK_ORG_PROFILES.find((p) => p.id === org.profile_id) || null })));
        setLoading(false);
      }
    };
    load();
  }, []);

  const whyCards = [
    {
      icon: 'ri-boxing-line', roleKey: 'partners_role_fighters',
      accent: '#E10600',
      pointKeys: ['partners_fighters_p1', 'partners_fighters_p2', 'partners_fighters_p3', 'partners_fighters_p4'],
    },
    {
      icon: 'ri-trophy-line', roleKey: 'partners_role_promoters',
      accent: '#f97316',
      pointKeys: ['partners_promoters_p1', 'partners_promoters_p2', 'partners_promoters_p3', 'partners_promoters_p4'],
    },
    {
      icon: 'ri-store-2-line', roleKey: 'partners_role_brands',
      accent: '#eab308',
      pointKeys: ['partners_brands_p1', 'partners_brands_p2', 'partners_brands_p3', 'partners_brands_p4'],
    },
  ];

  const typeKeyMap: Record<string, string> = {
    promoter: 'partners_type_promoter', gym: 'partners_type_gym',
    manager: 'partners_type_manager', brand: 'partners_type_brand', organizer: 'partners_type_organizer',
  };

  return (
    <section id="partners" className="py-24 md:py-32 bg-[#080808] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(225,6,0,0.05) 0%, transparent 60%)' }} />

      <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-6 h-px bg-[#E10600]" />
            <span className="text-[#E10600] text-xs font-semibold tracking-[0.2em] uppercase font-inter">{t('partners_eyebrow')}</span>
            <div className="w-6 h-px bg-[#E10600]" />
          </div>
          <h2 className="font-unbounded font-black text-white leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
            {t('partners_headline')}
          </h2>
          <p className="text-white/35 text-base max-w-2xl mx-auto font-inter">{t('partners_subtext')}</p>
        </div>

        {/* Org Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orgs.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-20">
            {orgs.map(({ org, profile }) => {
              const initials = (org.org_name || profile?.full_name || 'O').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={org.id}
                  className="rounded-2xl p-5 flex flex-col items-center gap-3 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-unbounded font-black text-white text-base bg-[#1a1a1a] flex-shrink-0">
                    {org.logo_url ? <img src={org.logo_url} alt={org.org_name} className="w-full h-full object-contain p-1 rounded-xl" /> : initials}
                  </div>
                  <div className="text-center">
                    <div className="text-white font-bold text-xs font-inter">{org.org_name || profile?.full_name}</div>
                    <div className="text-white/30 text-xs mt-0.5 font-inter">{t(typeKeyMap[org.org_type || ''] || 'partners_type_organizer')}</div>
                  </div>
                </div>
              );
            })}
            {orgs.length < 4 && Array.from({ length: 4 - orgs.length }).map((_, i) => (
              <div key={`soon-${i}`} className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2 min-h-[100px]"
                style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                <i className="ri-add-line text-white/15 text-xl" />
                <span className="text-white/15 text-xs font-inter">{t('label_coming_soon')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center mb-20">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <i className="ri-building-4-line text-2xl text-white/20" />
            </div>
            <h3 className="font-unbounded font-bold text-white text-sm mb-2">{t('partners_empty_title')}</h3>
            <p className="text-white/25 text-sm font-inter leading-relaxed max-w-sm">{t('partners_empty_desc')}</p>
          </div>
        )}

        {/* Why Rankd */}
        <div className="mb-16">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-px bg-[#E10600]" />
                <span className="text-[#E10600] text-xs font-semibold tracking-[0.2em] uppercase font-inter">{t('partners_why_eyebrow')}</span>
              </div>
              <h3 className="font-unbounded font-black text-white leading-tight" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)' }}>
                {t('partners_why_headline_1')}<br />
                <span className="font-light text-white/20">{t('partners_why_headline_2')}</span>
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {whyCards.map((item) => (
              <div key={item.roleKey} className="rounded-2xl p-7"
                style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid rgba(255,255,255,0.06)` }}>
                <div className="w-12 h-12 flex items-center justify-center rounded-xl mb-5"
                  style={{ background: `${item.accent}15`, border: `1px solid ${item.accent}25` }}>
                  <i className={`${item.icon} text-2xl`} style={{ color: item.accent }} />
                </div>
                <h4 className="font-unbounded font-bold text-white text-sm mb-5">{t(item.roleKey)}</h4>
                <ul className="space-y-3">
                  {item.pointKeys.map((pk) => (
                    <li key={pk} className="flex items-start gap-3 text-sm text-white/40 font-inter">
                      <i className="ri-check-line flex-shrink-0 mt-0.5" style={{ color: item.accent }} />
                      {t(pk)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden"
          style={{ background: 'rgba(225,6,0,0.06)', border: '1px solid rgba(225,6,0,0.15)' }}>
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.12) 0%, transparent 70%)' }} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-px bg-[#E10600]" />
              <span className="text-[#E10600] text-xs font-semibold tracking-[0.2em] uppercase font-inter">{t('partners_cta_eyebrow')}</span>
            </div>
            <h3 className="font-unbounded font-black text-white text-2xl md:text-3xl leading-tight mb-3">
              {t('partners_cta_headline_1')}<br />
              <span className="text-white/25 font-light">{t('partners_cta_headline_2')}</span>
            </h3>
            <p className="text-white/40 text-sm font-inter max-w-lg leading-relaxed">{t('partners_cta_desc')}</p>
          </div>
          <div className="flex-shrink-0 relative z-10">
            <a href="/auth" className="inline-flex items-center gap-3 bg-[#E10600] text-white font-semibold px-8 py-4 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter"
              style={{ boxShadow: '0 0 30px rgba(225,6,0,0.25)' }}>
              {t('partners_cta_btn')}
              <i className="ri-arrow-right-line" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

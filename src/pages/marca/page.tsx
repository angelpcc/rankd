import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile, Brand, BrandProduct, BrandService } from '@/lib/supabase';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import ReviewsPanel from '@/components/feature/ReviewsPanel';
import { trackBrandView, trackBrandWebsiteClick, trackBrandProductClick } from '@/lib/trackBrand';

interface SponsorPrefs { budget?: string; disciplines?: string[]; }

export default function MarcaPublicPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [services, setServices] = useState<BrandService[]>([]);
  const [prefs, setPrefs] = useState<SponsorPrefs>({});
  const [rating, setRating] = useState<{ avg: number; n: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSEO({ title: brand ? `${brand.name} | RANKD` : 'RANKD', description: brand?.description || 'Marca en RANKD.' });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (!prof || prof.user_type !== 'brand') { setNotFound(true); setLoading(false); return; }
      setProfile(prof);
      const [{ data: b }, { data: prods }, { data: servs }, { data: org }, { data: rat }] = await Promise.all([
        supabase.from('brands').select('*').eq('user_id', id).maybeSingle(),
        supabase.from('brand_products').select('*').eq('brand_profile_id', id).order('created_at', { ascending: false }),
        supabase.from('brand_services').select('*').eq('brand_profile_id', id).order('created_at', { ascending: false }),
        supabase.from('organizations').select('*').eq('profile_id', id).maybeSingle(),
        supabase.from('org_rating_summary').select('avg_rating, review_count').eq('org_profile_id', id).maybeSingle(),
      ]);
      setBrand(b);
      setProducts((prods || []) as BrandProduct[]);
      setServices((servs || []) as BrandService[]);
      if (org) {
        const ex = org as typeof org & { sponsorship_budget?: string; target_disciplines?: string[] };
        setPrefs({ budget: ex.sponsorship_budget, disciplines: Array.isArray(ex.target_disciplines) ? ex.target_disciplines : undefined });
      }
      if (rat) setRating({ avg: Number(rat.avg_rating) || 0, n: rat.review_count || 0 });
      setLoading(false);
      trackBrandView(id);
    };
    load();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-[#070707]"><Navbar /><div className="flex items-center justify-center" style={{ minHeight: '70vh' }}><div className="w-10 h-10 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div></div>;
  }
  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#070707]"><Navbar />
        <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: '70vh' }}>
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 mb-5"><i className="ri-store-2-line text-2xl text-[#C9A84C]" /></div>
          <h1 className="rk-h3 text-white">{t('pp_not_found')}</h1>
          <p className="text-sm text-zinc-400 mt-2">{t('pp_not_found_desc')}</p>
          <button onClick={() => navigate('/brands')} className="rk-btn rk-btn-gold mt-6" style={{ fontSize: '0.85rem' }}>{t('pp_back')}</button>
        </div>
      </div>
    );
  }

  const name = brand?.name || profile.full_name || '—';
  const website = profile.website || brand?.website;
  const showProducts = brand?.type !== 'service';
  const showServices = brand?.type === 'service' || brand?.type === 'both';

  return (
    <div className="min-h-screen bg-[#070707]">
      <Navbar />
      <div className="relative overflow-hidden rk-grid-bg" style={{ background: '#050505', paddingTop: 'calc(60px + env(safe-area-inset-top,0px))' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 82% 28%, rgba(201,168,76,0.16) 0%, transparent 58%)' }} />
        <div className="rk-topline" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 md:px-10 pt-6 pb-8">
          <button onClick={() => navigate('/brands')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer mb-6"><i className="ri-arrow-left-line" />{t('pp_back')}</button>
          <div className="flex items-start gap-4 flex-wrap">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt="" className="w-20 h-20 rounded-2xl object-contain bg-white/10 border border-white/10 p-1 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#C9A84C]/12 border border-[#C9A84C]/28 flex items-center justify-center flex-shrink-0"><i className="ri-store-2-line text-3xl text-[#C9A84C]" /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="rk-h2" style={{ color: '#fff', margin: 0, fontSize: 'clamp(1.8rem,5vw,2.8rem)' }}>{name}</h1>
                {profile.verified && <i className="ri-verified-badge-fill text-[#C9A84C] text-xl" title={t('pp_verified')} />}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {brand?.category && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border text-[#C9A84C] bg-[#C9A84C]/12 border-[#C9A84C]/28">{brand.category}</span>}
                {profile.location && <span className="text-xs text-zinc-400 flex items-center gap-1"><i className="ri-map-pin-line" />{profile.location}</span>}
                {rating && rating.n > 0 && <span className="text-xs text-[#C9A84C] flex items-center gap-1"><i className="ri-star-fill" />{rating.avg.toFixed(1)} ({rating.n})</span>}
              </div>
              {website && (
                <a href={website} target="_blank" rel="nofollow noreferrer" onClick={() => trackBrandWebsiteClick(profile.id)}
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-zinc-900 bg-[#C9A84C] hover:bg-[#dcc06a] px-4 py-2 rounded-xl transition-colors cursor-pointer">
                  <i className="ri-external-link-line" />{t('pp_visit_web')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 space-y-8">
        {brand?.description && (
          <div className="rk-card" style={{ padding: '20px 22px' }}>
            <h2 className="rk-h3 text-white mb-2" style={{ fontSize: '1rem' }}>{t('pp_about')}</h2>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{brand.description}</p>
          </div>
        )}

        {/* Escaparate de producto */}
        {showProducts && (
          <div>
            <h2 className="rk-h3 text-white mb-3 flex items-center gap-2" style={{ fontSize: '1.1rem' }}><i className="ri-store-3-line text-[#C9A84C]" />{t('pp_storefront')}</h2>
            {products.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('pp_no_products')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {products.map((p) => {
                  const inner = (
                    <>
                      <div className="relative h-36 bg-zinc-800 overflow-hidden">
                        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover object-top" /> : <div className="w-full h-full flex items-center justify-center"><i className="ri-image-line text-3xl text-zinc-600" /></div>}
                        {p.category && <span className="absolute top-2 left-2 bg-zinc-900/80 text-[#C9A84C] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#C9A84C]/20">{p.category}</span>}
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-bold text-white truncate">{p.name}</h3>
                        {p.description && <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{p.description}</p>}
                        <div className="flex items-center justify-between mt-2">
                          {p.price ? <span className="text-[#C9A84C] font-bold text-sm">{p.price}</span> : <span />}
                          {p.external_link && <span className="text-[11px] font-bold text-zinc-900 bg-[#C9A84C] px-2 py-1 rounded-lg inline-flex items-center gap-1"><i className="ri-shopping-cart-line" />{t('pp_buy')}</span>}
                        </div>
                      </div>
                    </>
                  );
                  const cls = 'rk-card overflow-hidden block';
                  return p.external_link ? (
                    <a key={p.id} href={p.external_link} target="_blank" rel="nofollow noreferrer" onClick={() => trackBrandProductClick(profile.id, p.id)} className={`${cls} cursor-pointer hover:border-[#C9A84C]/40`}>{inner}</a>
                  ) : (
                    <div key={p.id} className={cls}>{inner}</div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Servicios */}
        {showServices && services.length > 0 && (
          <div>
            <h2 className="rk-h3 text-white mb-3 flex items-center gap-2" style={{ fontSize: '1.1rem' }}><i className="ri-service-line text-[#C9A84C]" />{t('pp_services')}</h2>
            <div className="space-y-2">
              {services.map((s) => (
                <div key={s.id} className="rk-card flex items-center gap-3" style={{ padding: 14 }}>
                  {s.image_url ? <img src={s.image_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" /> : <div className="w-11 h-11 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0"><i className="ri-service-line text-[#C9A84C]" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.title}</p>
                    {s.description && <p className="text-[11px] text-zinc-500 line-clamp-1">{s.description}</p>}
                  </div>
                  {s.price && <span className="text-xs text-[#C9A84C] font-bold flex-shrink-0">{s.price}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Qué busca patrocinar — separado del escaparate */}
        {(prefs.disciplines?.length || prefs.budget) && (
          <div className="rk-card" style={{ padding: '20px 22px', borderColor: 'rgba(225,6,0,0.22)' }}>
            <h2 className="rk-h3 text-white mb-3 flex items-center gap-2" style={{ fontSize: '1rem' }}><i className="ri-hand-coin-line text-red-400" />{t('pp_sponsor_title')}</h2>
            {prefs.disciplines && prefs.disciplines.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] text-zinc-500 mb-1.5">{t('pp_disciplines')}</p>
                <div className="flex flex-wrap gap-1.5">{prefs.disciplines.map((d) => <span key={d} className="text-xs px-2.5 py-1 rounded-full bg-red-600/12 border border-red-500/30 text-red-300">{d}</span>)}</div>
              </div>
            )}
            {prefs.budget && <p className="text-xs text-zinc-400"><span className="text-zinc-500">{t('pp_budget')}:</span> <span className="text-white font-semibold">{prefs.budget}</span></p>}
          </div>
        )}

        <ReviewsPanel orgId={profile.id} />
      </div>
      <Footer />
    </div>
  );
}

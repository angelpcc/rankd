import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrands } from '@/hooks/useBrands';

export default function BrandsSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { brands, loading } = useBrands();

  const hasBrands = brands.length > 0;
  const displayBrands = brands.slice(0, 4);

  const features = [
    { icon: 'ri-store-2-line', labelKey: 'brands_feature1_label', descKey: 'brands_feature1_desc' },
    { icon: 'ri-user-star-line', labelKey: 'brands_feature2_label', descKey: 'brands_feature2_desc' },
    { icon: 'ri-links-line', labelKey: 'brands_feature3_label', descKey: 'brands_feature3_desc' },
  ];

  return (
    <section id="brands" className="py-24 md:py-32 bg-[#0d0d0d] overflow-hidden relative">
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.04) 0%, transparent 65%)' }} />

      <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-6 h-px bg-[#E10600]" />
              <span className="text-[#E10600] text-xs font-semibold tracking-[0.2em] uppercase font-inter">{t('brands_eyebrow')}</span>
            </div>
            <h2 className="font-unbounded font-black text-white leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
              {t('brands_headline_1')}<br />
              <span className="text-white/50 font-light">{t('brands_headline_2')}</span>
            </h2>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={() => navigate('/brands')}
              className="flex items-center gap-2 border border-white/15 text-white/50 text-sm font-semibold px-6 py-3 rounded-full hover:border-[#E10600] hover:text-[#E10600] transition-colors cursor-pointer whitespace-nowrap font-inter"
            >
              {t('btn_view_directory')} <i className="ri-arrow-right-line" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hasBrands ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {displayBrands.map((brand) => {
              const initials = brand.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={brand.id}
                  className="group rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="relative h-32 flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {brand.logo_url ? (
                      <img src={brand.logo_url} alt={brand.name} className="w-16 h-16 object-contain" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.15)' }}>
                        <span className="font-unbounded font-bold text-[#E10600] text-lg">{initials}</span>
                      </div>
                    )}
                    {brand.category && (
                      <span className="absolute top-3 right-3 text-white/65 text-xs font-semibold px-2.5 py-1 rounded-full font-inter"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {brand.category}
                      </span>
                    )}
                  </div>
                  <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <h3 className="font-unbounded font-bold text-white text-xs mb-1">{brand.name}</h3>
                    <p className="text-white/55 text-xs font-inter leading-relaxed line-clamp-2">{brand.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center mb-10"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl mb-5"
              style={{ background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.15)' }}>
              <i className="ri-store-2-line text-2xl text-[#E10600]" />
            </div>
            <h3 className="font-unbounded font-bold text-white text-sm mb-3">{t('brands_empty_title')}</h3>
            <p className="text-white/55 text-sm font-inter leading-relaxed max-w-sm mb-8">{t('brands_coming_soon_home')}</p>
            <button onClick={() => navigate('/brands')}
              className="inline-flex items-center gap-2 text-white/65 font-semibold text-sm px-6 py-3 rounded-full hover:text-white transition-colors cursor-pointer font-inter"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              {t('btn_know_more')} <i className="ri-arrow-right-line" />
            </button>
          </div>
        )}

        {/* Feature chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {features.map((item) => (
            <div key={item.labelKey}
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.15)' }}>
                <i className={`${item.icon} text-[#E10600] text-base`} />
              </div>
              <div>
                <div className="text-white font-semibold text-xs font-inter mb-0.5">{t(item.labelKey)}</div>
                <div className="text-white/55 text-xs font-inter">{t(item.descKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { BrandWithItems } from '@/hooks/useBrands';
import { trackBrandView, trackBrandWebsiteClick, trackBrandProductClick } from '@/lib/trackBrand';

interface Props {
  brand: BrandWithItems;
  rating?: { avg: number; n: number };
}

const MODALITY_ICONS: Record<string, string> = {
  online: 'ri-wifi-line',
  presencial: 'ri-map-pin-line',
  ambos: 'ri-global-line',
};

// Etiqueta de modalidad de servicio (código+etiqueta, se traduce).
const MODALITY_LABEL_KEYS: Record<string, string> = {
  online: 'dash_bs_mod_online',
  presencial: 'dash_bs_mod_presencial',
  ambos: 'dash_bs_mod_ambos',
};

const TYPE_CONFIG = {
  product: {
    headerBg: 'bg-gradient-to-br from-[#0B0B0B] to-[#1A1A1A]',
    badge: { labelKey: 'br_type_product', icon: 'ri-shopping-bag-line', cls: 'bg-white/10 text-white/70 border-white/15' },
    ctaColor: 'bg-[#E10600] hover:bg-red-700',
    ctaLabelKey: 'br_cta_website',
  },
  service: {
    headerBg: 'bg-gradient-to-br from-[#1A1200] to-[#2A1F00]',
    badge: { labelKey: 'br_type_service', icon: 'ri-service-line', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    ctaColor: 'bg-amber-500 hover:bg-amber-600',
    ctaLabelKey: 'br_cta_contact',
  },
  both: {
    headerBg: 'bg-gradient-to-br from-[#001A0D] to-[#002A18]',
    badge: { labelKey: 'br_type_both', icon: 'ri-store-3-line', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    ctaColor: 'bg-emerald-600 hover:bg-emerald-700',
    ctaLabelKey: 'br_cta_brand',
  },
};

export default function BrandDirectoryCard({ brand, rating }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const initials = brand.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const type = brand.type || 'product';
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.product;

  const showProducts = type === 'product' || type === 'both';
  const showServices = type === 'service' || type === 'both';

  const featuredProducts = brand.products.slice(0, type === 'both' ? 2 : 3);
  const featuredServices = brand.services.slice(0, type === 'both' ? 2 : 3);

  const hasProducts = brand.products.length > 0;
  const hasServices = brand.services.length > 0;
  const orgId = brand.user_id || '';

  // Impresión del escaparate: se cuenta una vez cuando la tarjeta entra en
  // pantalla (no en cada render), como "cuánta gente ha visto tu escaparate".
  const cardRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!orgId || !cardRef.current) return;
    const el = cardRef.current;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { trackBrandView(orgId); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [orgId]);

  return (
    <article ref={cardRef} className="group bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-red-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
      {/* Brand header (clic → perfil público de la marca) */}
      <div onClick={() => orgId && navigate(`/marca/${orgId}`)} className={`relative p-5 flex items-center gap-4 cursor-pointer ${cfg.headerBg}`}>
        {/* Logo */}
        <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center border border-white/10">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain p-1" />
          ) : (
            <span className="font-unbounded font-bold text-white text-base">{initials}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-unbounded font-bold text-white text-sm leading-tight truncate">{brand.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {brand.category && <span className="text-xs text-white/45 font-inter truncate">{brand.category}</span>}
            {rating && rating.n > 0 && <span className="text-[11px] text-[#C9A84C] flex items-center gap-0.5 flex-shrink-0"><i className="ri-star-fill"></i>{rating.avg.toFixed(1)}</span>}
          </div>
        </div>

        {/* Type badge */}
        <div className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold font-inter border ${cfg.badge.cls}`}>
          <i className={cfg.badge.icon}></i>
          {t(cfg.badge.labelKey)}
        </div>
      </div>

      {/* Description */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-gray-500 text-xs font-inter leading-relaxed line-clamp-2">
          {brand.description}
        </p>
      </div>

      {/* ── PRODUCTS section ── */}
      {showProducts && (
        <div className="px-5 pb-3">
          <p className="text-xs font-semibold text-white font-inter mb-2 flex items-center gap-1.5">
            <i className="ri-shopping-bag-line text-[#E10600]"></i>
            {t('br_products')}
            {hasProducts && <span className="text-gray-400 font-normal">({brand.products.length})</span>}
          </p>
          {hasProducts ? (
            <>
              <div className={`grid gap-2 ${type === 'both' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {featuredProducts.map((product) => {
                  const inner = (
                    <>
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="ri-image-line text-gray-300 text-xl"></i>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover/prod:bg-black/50 transition-colors flex items-end">
                        <div className="w-full p-1.5 translate-y-full group-hover/prod:translate-y-0 transition-transform duration-200">
                          <p className="text-white text-[10px] font-semibold leading-tight truncate">{product.name}</p>
                          {product.price && <p className="text-yellow-400 text-[10px] font-bold">{product.price}</p>}
                        </div>
                      </div>
                      {product.external_link && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/55 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/prod:opacity-100 transition-opacity">
                          <i className="ri-shopping-cart-line text-white text-[11px]"></i>
                        </span>
                      )}
                    </>
                  );
                  const cls = 'group/prod relative rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08] aspect-square block';
                  return product.external_link ? (
                    <a key={product.id} href={product.external_link} target="_blank" rel="nofollow noreferrer"
                      onClick={() => trackBrandProductClick(orgId, product.id)}
                      className={`${cls} cursor-pointer hover:border-yellow-500/40`}>
                      {inner}
                    </a>
                  ) : (
                    <div key={product.id} className={cls}>{inner}</div>
                  );
                })}
              </div>
              {brand.products.length > featuredProducts.length && (
                <p className="text-xs text-gray-400 font-inter mt-1.5">+{brand.products.length - featuredProducts.length} {t('br_more_suffix')}</p>
              )}
            </>
          ) : (
            <div className="bg-white/[0.04] rounded-xl px-3 py-2.5 flex items-center gap-2">
              <i className="ri-shopping-bag-line text-gray-300 text-sm"></i>
              <span className="text-xs text-gray-400 font-inter">{t('br_no_products')}</span>
            </div>
          )}
        </div>
      )}

      {/* ── SERVICES section ── */}
      {showServices && (
        <div className="px-5 pb-3">
          {type === 'both' && <div className="border-t border-white/[0.08] mb-3"></div>}
          <p className="text-xs font-semibold text-white font-inter mb-2 flex items-center gap-1.5">
            <i className="ri-service-line text-amber-500"></i>
            {t('br_services')}
            {hasServices && <span className="text-gray-400 font-normal">({brand.services.length})</span>}
          </p>
          {hasServices ? (
            <div className="space-y-1.5">
              {featuredServices.map((service) => (
                <div key={service.id} className="flex items-start gap-2.5 bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.08]">
                  {service.image_url ? (
                    <div className="w-9 h-9 flex-shrink-0 rounded-lg overflow-hidden">
                      <img src={service.image_url} alt={service.title} className="w-full h-full object-cover object-top" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                      <i className="ri-service-line text-amber-400 text-sm"></i>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{service.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {service.category && <span className="text-[10px] text-amber-600 font-semibold">{service.category}</span>}
                      {service.modality && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <i className={`${MODALITY_ICONS[service.modality] || 'ri-global-line'} text-[10px]`}></i>
                          {MODALITY_LABEL_KEYS[service.modality] ? t(MODALITY_LABEL_KEYS[service.modality]) : service.modality}
                        </span>
                      )}
                      {service.price && <span className="text-[10px] text-amber-600 font-bold">{service.price}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {brand.services.length > featuredServices.length && (
                <p className="text-xs text-gray-400 font-inter">+{brand.services.length - featuredServices.length} {t('br_more_suffix')}</p>
              )}
            </div>
          ) : (
            <div className="bg-white/[0.04] rounded-xl px-3 py-2.5 flex items-center gap-2">
              <i className="ri-service-line text-gray-300 text-sm"></i>
              <span className="text-xs text-gray-400 font-inter">{t('br_no_services')}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto px-5 pb-5 pt-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {type === 'both' && (
            <>
              {hasProducts && (
                <span className="text-[10px] text-gray-400 font-inter flex items-center gap-0.5">
                  <i className="ri-shopping-bag-line"></i>{brand.products.length} {t('br_prod_short')}
                </span>
              )}
              {hasServices && (
                <span className="text-[10px] text-gray-400 font-inter flex items-center gap-0.5">
                  <i className="ri-service-line"></i>{brand.services.length} {t('br_serv_short')}
                </span>
              )}
            </>
          )}
        </div>
        {brand.website ? (
          <a
            href={brand.website}
            target="_blank"
            rel="nofollow noreferrer"
            onClick={() => trackBrandWebsiteClick(orgId)}
            className={`flex items-center justify-center gap-1.5 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap font-inter ${cfg.ctaColor}`}
          >
            <i className="ri-external-link-line"></i>
            {t(cfg.ctaLabelKey)}
          </a>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl font-inter bg-white/[0.05] text-gray-400">
            <i className="ri-store-2-line"></i>
            {t('br_cta_brand')}
          </div>
        )}
      </div>
    </article>
  );
}

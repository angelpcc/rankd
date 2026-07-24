import { useTranslation } from 'react-i18next';
import type { Brand } from '@/lib/supabase';

interface BrandCardProps {
  brand: Brand;
}

export default function BrandCard({ brand }: BrandCardProps) {
  const { t } = useTranslation();

  const initials = brand.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-red-500/40 transition-all duration-300">
      {/* Cover / Logo area */}
      <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        {brand.logo_url ? (
          <img
            src={brand.logo_url}
            alt={brand.name}
            className="w-20 h-20 object-contain"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-[#E10600]/10 flex items-center justify-center">
            <span className="font-unbounded font-bold text-[#E10600] text-2xl">{initials}</span>
          </div>
        )}
        {brand.category && (
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-[#0B0B0B] text-xs font-semibold px-3 py-1 rounded-full font-inter">
            {brand.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-unbounded font-bold text-white text-sm mb-2">{brand.name}</h3>
        <p className="text-gray-400 text-xs font-inter leading-relaxed line-clamp-3 mb-4">
          {brand.description}
        </p>

        {brand.website && (
          <a
            href={brand.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#E10600] text-xs font-semibold font-inter hover:underline cursor-pointer"
          >
            <i className="ri-external-link-line"></i>
            {t('btn_visit_web') || 'Visitar web'}
          </a>
        )}
      </div>
    </div>
  );
}
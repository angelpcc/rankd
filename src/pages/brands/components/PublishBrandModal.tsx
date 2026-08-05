import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface PublishBrandModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

type BrandType = 'product' | 'service' | 'both';

const PRODUCT_CATEGORIES = [
  'MMA & Boxeo', 'Muay Thai', 'BJJ & Grappling',
  'Ropa deportiva', 'Suplementación', 'Equipamiento general',
];

const SERVICE_CATEGORIES = [
  'Patrocinio', 'Management', 'Nutrición',
  'Fisioterapia', 'Equipamiento para eventos', 'Otros',
];

const ALL_CATEGORIES = [
  ...PRODUCT_CATEGORIES,
  ...SERVICE_CATEGORIES.filter((c) => !PRODUCT_CATEGORIES.includes(c)),
];

const TYPE_OPTIONS: {
  value: BrandType;
  icon: string;
  titleKey: string;
  descKey: string;
  examplesKey: string;
  accent: string;
}[] = [
  {
    value: 'product',
    icon: 'ri-shopping-bag-line',
    titleKey: 'br_type_product_title',
    descKey: 'br_type_product_desc',
    examplesKey: 'br_type_product_examples',
    accent: 'border-[#E10600] bg-red-50/40',
  },
  {
    value: 'service',
    icon: 'ri-service-line',
    titleKey: 'br_type_service_title',
    descKey: 'br_type_service_desc',
    examplesKey: 'br_type_service_examples',
    accent: 'border-amber-400 bg-amber-50/40',
  },
  {
    value: 'both',
    icon: 'ri-store-3-line',
    titleKey: 'br_type_both_title',
    descKey: 'br_type_both_desc',
    examplesKey: 'br_type_both_examples',
    accent: 'border-emerald-500 bg-emerald-50/40',
  },
];

const TYPE_BADGE: Record<BrandType, { labelKey: string; icon: string; cls: string }> = {
  product: { labelKey: 'br_type_product_title', icon: 'ri-shopping-bag-line', cls: 'bg-[#E10600]/10 text-[#E10600]' },
  service: { labelKey: 'br_type_service_title', icon: 'ri-service-line', cls: 'bg-amber-50 text-amber-600' },
  both:    { labelKey: 'br_type_both_title', icon: 'ri-store-3-line', cls: 'bg-emerald-50 text-emerald-700' },
};

export default function PublishBrandModal({ onClose, onSuccess }: PublishBrandModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [brandType, setBrandType] = useState<BrandType>('product');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [descLength, setDescLength] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const getCategoryOptions = () => {
    if (brandType === 'product') return PRODUCT_CATEGORIES;
    if (brandType === 'service') return SERVICE_CATEGORIES;
    return ALL_CATEGORIES;
  };

  const getDescPlaceholder = () => {
    if (brandType === 'product') return t('br_desc_ph_product');
    if (brandType === 'service') return t('br_desc_ph_service');
    return t('br_desc_ph_both');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const desc = (form.elements.namedItem('descripcion') as HTMLTextAreaElement).value;
    if (desc.length > 500) { setError(t('br_err_desc_max')); return; }

    const name = (form.elements.namedItem('nombre_marca') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const website = (form.elements.namedItem('web_oficial') as HTMLInputElement).value;
    const category = (form.elements.namedItem('categoria') as HTMLSelectElement).value;
    const logo_url = (form.elements.namedItem('logo_url') as HTMLInputElement).value;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: supaError } = await supabase.from('brands').insert({
        user_id: user?.id || null,
        name, email,
        website: website || null,
        category: category || null,
        description: desc,
        logo_url: logo_url || null,
        status: 'pending',
        type: brandType,
      });
      if (supaError) { setError(supaError.message); setSubmitting(false); return; }
      setSubmitted(true);
      onSuccess?.();
    } catch {
      setError(t('br_err_save'));
    } finally {
      setSubmitting(false);
    }
  };

  const badge = TYPE_BADGE[brandType];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-unbounded font-bold text-[#0B0B0B] text-base">{t('br_publish')}</h2>
            <p className="text-gray-400 text-xs font-inter mt-0.5">
              {step === 'type' ? t('br_choose_type') : t(badge.labelKey)}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {submitted ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-full bg-green-50">
                <i className="ri-check-line text-3xl text-green-500"></i>
              </div>
              <h3 className="font-unbounded font-bold text-[#0B0B0B] text-base mb-2">{t('br_registered')}</h3>
              <p className="text-gray-400 text-sm font-inter leading-relaxed max-w-xs mx-auto">
                {t('br_registered_desc')}
              </p>
              <button onClick={onClose} className="mt-6 bg-[#E10600] text-white font-semibold text-sm px-6 py-3 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter">
                {t('br_close')}
              </button>
            </div>
          ) : step === 'type' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 font-inter leading-relaxed">
                {t('br_which_type')}
              </p>
              <div className="grid grid-cols-1 gap-3">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBrandType(opt.value)}
                    className={`w-full text-left p-5 rounded-xl border-2 transition-all cursor-pointer ${brandType === opt.value ? opt.accent : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${brandType === opt.value ? 'bg-current/10' : 'bg-gray-100'}`}>
                        <i className={`${opt.icon} text-lg ${brandType === opt.value ? (opt.value === 'product' ? 'text-[#E10600]' : opt.value === 'service' ? 'text-amber-500' : 'text-emerald-600') : 'text-gray-400'}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-unbounded font-bold text-[#0B0B0B] text-sm">{t(opt.titleKey)}</span>
                          {brandType === opt.value && (
                            <span className={`w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${opt.value === 'product' ? 'bg-[#E10600]' : opt.value === 'service' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                              <i className="ri-check-line text-white text-xs"></i>
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs font-inter mt-1 leading-relaxed">{t(opt.descKey)}</p>
                        <p className="text-gray-300 text-xs font-inter mt-1 italic">{t(opt.examplesKey)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep('form')}
                className="w-full bg-[#E10600] text-white font-semibold text-sm py-3.5 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter flex items-center justify-center gap-2 mt-2"
              >
                {t('br_continue')}
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('type')}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer font-inter mb-2"
              >
                <i className="ri-arrow-left-line"></i>
                {t('br_change_type')}
              </button>

              {/* Type badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold font-inter ${badge.cls}`}>
                <i className={badge.icon}></i>
                {t(badge.labelKey)}
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">
                  {t('br_name_label')} <span className="text-[#E10600]">*</span>
                </label>
                <input
                  type="text" name="nombre_marca" required
                  placeholder={t('br_name_ph')}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">
                  {t('br_email_label')} <span className="text-[#E10600]">*</span>
                </label>
                <input
                  type="email" name="email" required
                  placeholder={t('br_email_ph')}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors"
                />
              </div>

              {/* Web */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">{t('br_web_label')}</label>
                <input
                  type="url" name="web_oficial"
                  placeholder={t('br_web_ph')}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">
                  {t('br_cat_label')} <span className="text-[#E10600]">*</span>
                </label>
                <select
                  name="categoria" required
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] focus:outline-none focus:border-[#E10600] transition-colors bg-white cursor-pointer"
                >
                  <option value="">{t('br_cat_select')}</option>
                  {getCategoryOptions().map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">
                  {t('br_desc_label')} <span className="text-[#E10600]">*</span>
                </label>
                <textarea
                  name="descripcion" required rows={4} maxLength={500}
                  placeholder={getDescPlaceholder()}
                  onChange={(e) => setDescLength(e.target.value.length)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors resize-none"
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs font-inter ${descLength > 480 ? 'text-[#E10600]' : 'text-gray-300'}`}>{descLength}/500</span>
                </div>
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">{t('br_logo_label')}</label>
                <input
                  type="url" name="logo_url"
                  placeholder={t('br_logo_ph')}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors"
                />
                <p className="text-xs text-gray-300 font-inter mt-1">{t('br_logo_hint')}</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-inter px-4 py-3 rounded-lg flex items-center gap-2">
                  <i className="ri-error-warning-line"></i>
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={submitting}
                className="w-full bg-[#E10600] text-white font-semibold text-sm py-3.5 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>{t('br_saving')}</>
                  : <><i className="ri-send-plane-line"></i>{t('br_save')}</>
                }
              </button>
              <p className="text-center text-xs text-gray-300 font-inter">{t('br_after_review')}</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

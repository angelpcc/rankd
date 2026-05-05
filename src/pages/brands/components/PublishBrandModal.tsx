import { useState, useEffect } from 'react';
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
  title: string;
  desc: string;
  examples: string;
  accent: string;
}[] = [
  {
    value: 'product',
    icon: 'ri-shopping-bag-line',
    title: 'Marca de producto',
    desc: 'Vende o muestra equipamiento, ropa, suplementos u otros productos físicos para deportistas de combate.',
    examples: 'Guantes, vendas, ropa, nutrición...',
    accent: 'border-[#E10600] bg-red-50/40',
  },
  {
    value: 'service',
    icon: 'ri-service-line',
    title: 'Marca de servicio',
    desc: 'Ofrece servicios profesionales como patrocinio, management, fisioterapia, nutrición o equipamiento para eventos.',
    examples: 'Patrocinio, management, fisio, nutrición...',
    accent: 'border-amber-400 bg-amber-50/40',
  },
  {
    value: 'both',
    icon: 'ri-store-3-line',
    title: 'Productos y servicios',
    desc: 'Tu marca ofrece tanto productos físicos como servicios profesionales dentro del ecosistema de combate.',
    examples: 'Equipamiento + patrocinio, ropa + management...',
    accent: 'border-emerald-500 bg-emerald-50/40',
  },
];

const TYPE_BADGE: Record<BrandType, { label: string; icon: string; cls: string }> = {
  product: { label: 'Marca de producto', icon: 'ri-shopping-bag-line', cls: 'bg-[#E10600]/10 text-[#E10600]' },
  service: { label: 'Marca de servicio', icon: 'ri-service-line', cls: 'bg-amber-50 text-amber-600' },
  both:    { label: 'Productos y servicios', icon: 'ri-store-3-line', cls: 'bg-emerald-50 text-emerald-700' },
};

export default function PublishBrandModal({ onClose, onSuccess }: PublishBrandModalProps) {
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
    if (brandType === 'product') return 'Cuéntanos qué hace especial a tu marca, qué productos ofrecéis y a qué deportistas va dirigida...';
    if (brandType === 'service') return 'Describe los servicios que ofreces, a quién van dirigidos y qué os diferencia...';
    return 'Describe tu marca, los productos que vendéis y los servicios que ofrecéis dentro del ecosistema de combate...';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const desc = (form.elements.namedItem('descripcion') as HTMLTextAreaElement).value;
    if (desc.length > 500) { setError('La descripción no puede superar los 500 caracteres.'); return; }

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
      setError('Error al guardar. Inténtalo de nuevo.');
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
            <h2 className="font-unbounded font-bold text-[#0B0B0B] text-base">Publicar marca</h2>
            <p className="text-gray-400 text-xs font-inter mt-0.5">
              {step === 'type' ? 'Elige el tipo de marca' : badge.label}
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
              <h3 className="font-unbounded font-bold text-[#0B0B0B] text-base mb-2">¡Marca registrada!</h3>
              <p className="text-gray-400 text-sm font-inter leading-relaxed max-w-xs mx-auto">
                Tu marca ha sido guardada y aparecerá en el directorio tras ser revisada.
              </p>
              <button onClick={onClose} className="mt-6 bg-[#E10600] text-white font-semibold text-sm px-6 py-3 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter">
                Cerrar
              </button>
            </div>
          ) : step === 'type' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 font-inter leading-relaxed">
                ¿Qué tipo de marca quieres registrar en Rankd?
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
                          <span className="font-unbounded font-bold text-[#0B0B0B] text-sm">{opt.title}</span>
                          {brandType === opt.value && (
                            <span className={`w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${opt.value === 'product' ? 'bg-[#E10600]' : opt.value === 'service' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                              <i className="ri-check-line text-white text-xs"></i>
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs font-inter mt-1 leading-relaxed">{opt.desc}</p>
                        <p className="text-gray-300 text-xs font-inter mt-1 italic">{opt.examples}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep('form')}
                className="w-full bg-[#E10600] text-white font-semibold text-sm py-3.5 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter flex items-center justify-center gap-2 mt-2"
              >
                Continuar
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
                Cambiar tipo
              </button>

              {/* Type badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold font-inter ${badge.cls}`}>
                <i className={badge.icon}></i>
                {badge.label}
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">
                  Nombre de la marca <span className="text-[#E10600]">*</span>
                </label>
                <input
                  type="text" name="nombre_marca" required
                  placeholder="Ej: Venum, Hayabusa, RDX..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">
                  Email de contacto <span className="text-[#E10600]">*</span>
                </label>
                <input
                  type="email" name="email" required
                  placeholder="hola@tumarca.com"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors"
                />
              </div>

              {/* Web */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">Web oficial</label>
                <input
                  type="url" name="web_oficial"
                  placeholder="https://tumarca.com"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">
                  Categoría principal <span className="text-[#E10600]">*</span>
                </label>
                <select
                  name="categoria" required
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] focus:outline-none focus:border-[#E10600] transition-colors bg-white cursor-pointer"
                >
                  <option value="">Selecciona una categoría</option>
                  {getCategoryOptions().map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">
                  Descripción breve <span className="text-[#E10600]">*</span>
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
                <label className="block text-xs font-semibold text-[#0B0B0B] font-inter mb-1.5">URL del logo (opcional)</label>
                <input
                  type="url" name="logo_url"
                  placeholder="https://tumarca.com/logo.png"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-inter text-[#0B0B0B] placeholder-gray-300 focus:outline-none focus:border-[#E10600] transition-colors"
                />
                <p className="text-xs text-gray-300 font-inter mt-1">También puedes enviarnos el logo por email tras el registro.</p>
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
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Guardando...</>
                  : <><i className="ri-send-plane-line"></i>Guardar marca</>
                }
              </button>
              <p className="text-center text-xs text-gray-300 font-inter">Tu marca aparecerá en el directorio tras ser revisada</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

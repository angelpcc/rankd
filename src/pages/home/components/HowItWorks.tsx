import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function HowItWorks() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const steps = [
    { number: '01', icon: 'ri-user-add-line', titleKey: 'how_step1_title', descKey: 'how_step1_desc' },
    { number: '02', icon: 'ri-search-eye-line', titleKey: 'how_step2_title', descKey: 'how_step2_desc' },
    { number: '03', icon: 'ri-shake-hands-line', titleKey: 'how_step3_title', descKey: 'how_step3_desc' },
    { number: '04', icon: 'ri-trophy-line', titleKey: 'how_step4_title', descKey: 'how_step4_desc' },
  ];

  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-[#0d0d0d] relative overflow-hidden">
      {/* Glow de fondo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(225,6,0,0.04) 0%, transparent 65%)' }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8 mb-16 sm:mb-20">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-6 h-px bg-[#E10600]" />
              <span className="text-[#E10600] text-xs font-semibold tracking-[0.2em] uppercase font-inter">
                {t('how_eyebrow')}
              </span>
            </div>
            <h2 className="font-unbounded font-black text-white leading-tight" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.5rem)' }}>
              {t('how_headline_1')}<br />
              <span className="font-light text-white/20">{t('how_headline_2')}</span>
            </h2>
          </div>
          <p className="text-white/35 text-sm sm:text-base leading-relaxed max-w-md lg:text-right font-inter">
            {t('how_subtext')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px"
          style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative p-8 group transition-colors duration-300"
              style={{ background: '#0d0d0d' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#111'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#0d0d0d'; }}
            >
              {/* Big number BG */}
              <span className="font-unbounded text-[80px] font-black absolute top-2 right-4 select-none leading-none pointer-events-none"
                style={{ color: 'rgba(255,255,255,0.025)' }}>
                {step.number}
              </span>

              {/* Connector arrow desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 items-center justify-center rounded-full"
                  style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <i className="ri-arrow-right-s-line text-white/20 text-xs" />
                </div>
              )}

              {/* Icon */}
              <div className="w-12 h-12 flex items-center justify-center rounded-xl mb-6 relative z-10 transition-all duration-300 group-hover:scale-110"
                style={{ background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.2)' }}>
                <i className={`${step.icon} text-xl text-[#E10600]`} />
              </div>

              {/* Step num small */}
              <div className="text-[#E10600] text-xs font-bold tracking-widest mb-2 font-inter relative z-10">{step.number}</div>

              <h3 className="font-unbounded font-bold text-white text-base mb-3 relative z-10 leading-snug">
                {t(step.titleKey)}
              </h3>
              <p className="text-white/35 text-sm leading-relaxed relative z-10 font-inter">
                {t(step.descKey)}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/auth')}
            className="inline-flex items-center gap-3 bg-[#E10600] text-white font-semibold px-8 py-4 rounded-full hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap font-inter"
            style={{ boxShadow: '0 0 30px rgba(225,6,0,0.25)' }}
          >
            {t('btn_start_free')}
            <i className="ri-arrow-right-line" />
          </button>
          <span className="text-white/20 text-sm font-inter">Sin tarjeta. Sin coste.</span>
        </div>
      </div>
    </section>
  );
}

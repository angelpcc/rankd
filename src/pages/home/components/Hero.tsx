import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Hero() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section id="home" className="relative w-full min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#080808]">
        {/* Grid sutil */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        {/* Diagonal accent line */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-10%', left: '-5%',
            width: '60%', height: '120%',
            background: 'linear-gradient(135deg, rgba(225,6,0,0.06) 0%, transparent 55%)',
          }}
        />
        {/* Glow rojo derecha */}
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.1) 0%, transparent 65%)' }}
        />
        {/* Glow rojo inferior izquierda */}
        <div
          className="absolute bottom-0 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.05) 0%, transparent 70%)' }}
        />
      </div>

      {/* Línea roja top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E10600] via-[#ff2020] to-transparent" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 md:px-12 pt-32 pb-20 sm:pb-28 flex flex-col lg:flex-row items-start lg:items-center gap-16">
        {/* Left */}
        <div className="flex-1">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-px bg-[#E10600]" />
            <span className="text-[#E10600] text-xs font-semibold tracking-[0.25em] uppercase font-inter">
              {t('hero_eyebrow')}
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-unbounded font-black text-white leading-[0.97] mb-8"
            style={{ fontSize: 'clamp(2.6rem, 7vw, 7rem)' }}
          >
            {t('hero_headline_1')}<br />
            <span style={{ color: '#E10600' }}>{t('hero_headline_2')}</span><br />
            {t('hero_headline_3')}
          </h1>

          {/* Subtext */}
          <p className="text-white/40 text-base md:text-lg font-light leading-relaxed mb-10 max-w-lg font-inter">
            {t('hero_subtext')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center justify-center gap-3 bg-[#E10600] text-white font-semibold px-8 py-4 rounded-full hover:bg-red-700 transition-all cursor-pointer whitespace-nowrap text-sm sm:text-base font-inter w-full sm:w-auto"
              style={{ boxShadow: '0 0 40px rgba(225,6,0,0.3)' }}
            >
              {t('btn_create_free')}
              <i className="ri-arrow-right-line" />
            </button>
            <button
              onClick={() => navigate('/opportunities')}
              className="inline-flex items-center justify-center gap-3 border border-white/12 text-white/50 font-semibold px-8 py-4 rounded-full hover:border-white/30 hover:text-white transition-all cursor-pointer whitespace-nowrap text-sm sm:text-base font-inter w-full sm:w-auto"
            >
              {t('btn_explore_opportunities')}
            </button>
          </div>

          {/* Indicators */}
          <div
            className="flex flex-wrap items-center gap-6 mt-14 pt-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <p className="text-white/25 text-xs font-inter">{t('hero_indicator_active')}</p>
            </div>
            <div className="w-px h-4 bg-white/8 hidden sm:block" />
            <p className="text-white/15 text-xs font-inter">{t('hero_indicator_disciplines')}</p>
            <div className="w-px h-4 bg-white/8 hidden sm:block" />
            <p className="text-white/15 text-xs font-inter">{t('hero_indicator_location')}</p>
          </div>
        </div>

        {/* Right — Stats panel */}
        <div className="hidden lg:flex flex-col gap-4 flex-shrink-0">
          {[
            { num: '100%', label: 'Gratuito', sub: 'Sin coste, sin trampa' },
            { num: '0€', label: 'Comisiones', sub: 'Contacto directo' },
            { num: '3', label: 'Roles', sub: 'Peleador · Org · Marca' },
          ].map((s) => (
            <div
              key={s.label}
              className="w-52 px-6 py-5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="font-unbounded font-black text-white text-3xl leading-none mb-1">{s.num}</div>
              <div className="text-[#E10600] text-xs font-bold tracking-wider uppercase mb-1">{s.label}</div>
              <div className="text-white/25 text-xs font-inter">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 right-12 hidden md:flex flex-col items-center gap-2">
        <div className="w-px h-14 bg-gradient-to-b from-transparent to-white/12" />
        <span
          className="text-white/15 text-[10px] tracking-[0.3em] uppercase font-inter"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t('label_scroll')}
        </span>
      </div>
    </section>
  );
}

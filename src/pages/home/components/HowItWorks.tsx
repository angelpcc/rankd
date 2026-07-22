import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/base/Reveal';

const STEPS = [
  { number: '01', icon: 'ri-user-add-line', titleKey: 'how_step1_title', descKey: 'how_step1_desc', color: '#E10600', img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/crear%20perfil.png' },
  { number: '02', icon: 'ri-search-eye-line', titleKey: 'how_step2_title', descKey: 'how_step2_desc', color: '#C9A84C', img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/se%20descubierto.png' },
  { number: '03', icon: 'ri-shake-hands-line', titleKey: 'how_step3_title', descKey: 'how_step3_desc', color: '#E10600', img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/negocia.png' },
  { number: '04', icon: 'ri-rocket-line', titleKey: 'how_step4_title', descKey: 'how_step4_desc', color: '#C9A84C', img: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/impulsa.png' },
];

export default function HowItWorks() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section
      id="how-it-works"
      style={{ position: 'relative', background: 'var(--rk-black)', padding: 'var(--sp-section) 0', overflow: 'hidden' }}
    >
      {/* Ambiente */}
      <div className="rk-glow-red" style={{ top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '55%' }} />
      <div className="rk-grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.35, maskImage: 'radial-gradient(ellipse at 50% 30%, black, transparent 72%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black, transparent 72%)' }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1320, margin: '0 auto', padding: '0 24px' }}>

        {/* ── CABECERA ── */}
        <div className="hiw-head" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'end', marginBottom: 52 }}>
          <Reveal>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <span className="rk-index">PROCESO</span>
              <span style={{ flex: '0 0 42px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
              <span className="rk-eyebrow">{t('how_eyebrow')}</span>
            </div>
            <h2 className="rk-h1" style={{ margin: 0, color: '#fff' }}>
              {t('how_headline_1')}<br />
              <span className="rk-red-glow">{t('how_headline_2')}</span>
            </h2>
          </Reveal>

          <Reveal delay={140}>
            <p className="rk-body" style={{ maxWidth: 380, margin: 0, paddingBottom: 6 }}>
              {t('how_subtext')}
            </p>
          </Reveal>
        </div>

        <Reveal delay={80}>
          <div className="rk-rule" style={{ marginBottom: 44 }} />
        </Reveal>

        {/* ── PASOS ── */}
        <div className="hiw-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 56 }}>
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={i * 110} variant="up">
              <article
                className="rk-card rk-img-wrap"
                style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 18 }}
              >
                {/* Imagen */}
                <div className="rk-img-wrap rk-img-treat" style={{ position: 'relative', height: 190, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={step.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
                  {/* Número grande */}
                  <span
                    style={{
                      position: 'absolute', bottom: 10, right: 14, zIndex: 2,
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 58, lineHeight: 0.8,
                      color: 'transparent', WebkitTextStroke: `1px ${step.color}77`,
                      pointerEvents: 'none',
                    }}
                  >
                    {step.number}
                  </span>
                  {/* Barra superior de acento */}
                  <span style={{ position: 'absolute', top: 0, left: 0, width: '38%', height: 2, background: step.color, zIndex: 2 }} />
                </div>

                {/* Texto */}
                <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${step.color}16`, border: `1px solid ${step.color}38`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={step.icon} style={{ color: step.color, fontSize: 15 }} />
                  </div>
                  <h3 className="rk-h3" style={{ margin: 0, color: '#fff' }}>{t(step.titleKey)}</h3>
                  <p className="rk-body" style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.6 }}>{t(step.descKey)}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* ── CTA ── */}
        <Reveal delay={120}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <button className="rk-btn rk-btn-primary" style={{ padding: '1.05rem 3rem' }} onClick={() => navigate('/auth')}>
              {t('btn_start_free')} →
            </button>
            <span className="rk-body" style={{ fontSize: '0.8rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rk-text-3)' }}>
              Sin tarjeta · Sin comisiones · Menos de 2 minutos
            </span>
          </div>
        </Reveal>
      </div>

      <style>{`
        @media (max-width: 1024px) { .hiw-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 780px) {
          .hiw-head { grid-template-columns: 1fr !important; align-items: start !important; gap: 20px !important; }
          .hiw-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
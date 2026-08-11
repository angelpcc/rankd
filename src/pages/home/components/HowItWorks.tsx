import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/base/Reveal';

// Un camino por cada tipo de usuario: la plataforma completa, no solo el
// peleador buscando visibilidad. Cada tarjeta enlaza a su recorrido detallado
// en /como-funciona (que abre ya en la pestaña correspondiente).
const PATHS = [
  {
    role: 'fighter',
    icon: 'ri-boxing-line',
    color: '#E10600',
    titleKey: 'how_role_fighter_title',
    descKey: 'how_role_fighter_desc',
    chips: ['how_role_fighter_c1', 'how_role_fighter_c2', 'how_role_fighter_c3'],
  },
  {
    role: 'org',
    icon: 'ri-trophy-line',
    color: '#E10600',
    titleKey: 'how_role_org_title',
    descKey: 'how_role_org_desc',
    chips: ['how_role_org_c1', 'how_role_org_c2', 'how_role_org_c3'],
  },
  {
    role: 'brand',
    icon: 'ri-store-2-line',
    color: '#C9A84C',
    titleKey: 'how_role_brand_title',
    descKey: 'how_role_brand_desc',
    chips: ['how_role_brand_c1', 'how_role_brand_c2', 'how_role_brand_c3'],
  },
  {
    role: 'public',
    icon: 'ri-user-heart-line',
    color: '#C9A84C',
    titleKey: 'how_role_public_title',
    descKey: 'how_role_public_desc',
    chips: ['how_role_public_c1', 'how_role_public_c2', 'how_role_public_c3'],
  },
];

export default function HowItWorks() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section
      id="how-it-works"
      className="rk-viewport-section"
      style={{ position: 'relative', background: 'var(--rk-black)', overflow: 'hidden' }}
    >
      {/* Ambiente */}
      <div className="rk-glow-red" style={{ top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '55%' }} />
      <div className="rk-grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.35, maskImage: 'radial-gradient(ellipse at 50% 30%, black, transparent 72%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black, transparent 72%)' }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1320, margin: '0 auto', padding: '0 24px' }}>

        {/* ── CABECERA ── */}
        <div className="hiw-head" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'end', marginBottom: 32 }}>
          <Reveal>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <span className="rk-index">RANKD</span>
              <span style={{ flex: '0 0 42px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
              <span className="rk-eyebrow">{t('how_eyebrow')}</span>
            </div>
            <h2 className="rk-h1" style={{ margin: 0, color: '#fff' }}>
              {t('how_headline_1')}<br />
              <span className="rk-red-glow">{t('how_headline_2')}</span>
            </h2>
          </Reveal>

          <Reveal delay={140}>
            <p className="rk-body" style={{ maxWidth: 400, margin: 0, paddingBottom: 6 }}>
              {t('how_subtext')}
            </p>
          </Reveal>
        </div>

        <Reveal delay={80}>
          <div className="rk-rule" style={{ marginBottom: 28 }} />
        </Reveal>

        {/* ── CAMINOS POR AUDIENCIA ── */}
        <div className="hiw-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {PATHS.map((p, i) => (
            <Reveal key={p.role} delay={i * 110} variant="up">
              <button
                onClick={() => navigate(`/como-funciona?role=${p.role}`)}
                className="rk-card group"
                style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 18, padding: '26px 22px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                {/* Barra de acento superior */}
                <span style={{ position: 'absolute', top: 0, left: 0, width: '42%', height: 3, background: p.color }} />

                <div style={{ width: 46, height: 46, borderRadius: 12, background: `${p.color}16`, border: `1px solid ${p.color}3a`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <i className={p.icon} style={{ color: p.color, fontSize: 22 }} />
                </div>

                <h3 className="rk-h3" style={{ margin: 0, color: '#fff' }}>{t(p.titleKey)}</h3>
                <p className="rk-body" style={{ margin: '10px 0 0', fontSize: '0.92rem', lineHeight: 1.6, flex: 1 }}>{t(p.descKey)}</p>

                {/* Chips de lo que obtiene */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
                  {p.chips.map((c) => (
                    <span key={c} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '0.03em', color: 'rgba(255,255,255,0.72)', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 10px' }}>
                      {t(c)}
                    </span>
                  ))}
                </div>

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: p.color }} className="group-hover:gap-2">
                  {t('how_role_see_path')} <i className="ri-arrow-right-line" />
                </span>
              </button>
            </Reveal>
          ))}
        </div>

        {/* ── CTA ── */}
        <Reveal delay={120}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="rk-btn rk-btn-primary" style={{ padding: '1.05rem 2.6rem' }} onClick={() => navigate('/auth')}>
                {t('btn_start_free')} →
              </button>
              <button className="rk-btn rk-btn-ghost" style={{ padding: '1.05rem 2.2rem' }} onClick={() => navigate('/como-funciona')}>
                {t('how_role_see_path').toUpperCase()}
              </button>
            </div>
            <span className="rk-body" style={{ fontSize: '0.8rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rk-text-3)' }}>
              {t('how_role_fighter_title')} · {t('how_role_org_title')} · {t('how_role_brand_title')} · {t('how_role_public_title')}
            </span>
          </div>
        </Reveal>
      </div>

      <style>{`
        @media (max-width: 1024px) { .hiw-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 560px) {
          .hiw-head { grid-template-columns: 1fr !important; align-items: start !important; gap: 20px !important; }
          .hiw-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

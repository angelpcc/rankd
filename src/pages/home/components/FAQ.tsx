import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/base/Reveal';

// Preguntas reales que cubren los cuatro perfiles (peleador, promotora, marca
// y afición). Respuestas honestas con la voz de RANKD: directo y sin humo.
const ITEMS = [
  { q: 'faq_q1', a: 'faq_a1', icon: 'ri-question-line' },
  { q: 'faq_q2', a: 'faq_a2', icon: 'ri-price-tag-3-line' },
  { q: 'faq_q3', a: 'faq_a3', icon: 'ri-boxing-line' },
  { q: 'faq_q4', a: 'faq_a4', icon: 'ri-megaphone-line' },
  { q: 'faq_q5', a: 'faq_a5', icon: 'ri-trophy-line' },
  { q: 'faq_q6', a: 'faq_a6', icon: 'ri-store-2-line' },
  { q: 'faq_q7', a: 'faq_a7', icon: 'ri-user-heart-line' },
  { q: 'faq_q8', a: 'faq_a8', icon: 'ri-shield-check-line' },
];

export default function FAQ() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" style={{ position: 'relative', background: 'var(--rk-black)', padding: 'var(--sp-section) 0', overflow: 'hidden' }}>
      <div className="rk-glow-red" style={{ top: '-5%', left: '50%', transform: 'translateX(-50%)', width: '70%', height: '45%', opacity: 0.5 }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
        {/* Cabecera */}
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, justifyContent: 'center' }}>
            <span style={{ flex: '0 0 42px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
            <span className="rk-eyebrow">{t('faq_eyebrow')}</span>
            <span style={{ flex: '0 0 42px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
          </div>
          <h2 className="rk-h1" style={{ margin: 0, color: '#fff', textAlign: 'center' }}>
            {t('faq_headline_1')} <span className="rk-red-glow">{t('faq_headline_2')}</span>
          </h2>
          <p className="rk-body" style={{ maxWidth: 520, margin: '16px auto 0', textAlign: 'center' }}>
            {t('faq_subtext')}
          </p>
        </Reveal>

        {/* Acordeón */}
        <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={Math.min(i, 6) * 60}>
                <div className="rk-card" style={{ padding: 0, overflow: 'hidden', borderColor: isOpen ? 'rgba(225,6,0,0.35)' : undefined, transform: 'none' }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '20px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: isOpen ? 'rgba(225,6,0,0.14)' : 'rgba(255,255,255,0.045)', border: `1px solid ${isOpen ? 'rgba(225,6,0,0.4)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                      <i className={item.icon} style={{ fontSize: 18, color: isOpen ? '#E10600' : 'rgba(255,255,255,0.6)' }} />
                    </span>
                    <span style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 19, fontWeight: 600, letterSpacing: '0.02em', color: isOpen ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                      {t(item.q)}
                    </span>
                    <i className="ri-arrow-down-s-line" style={{ fontSize: 24, color: isOpen ? '#E10600' : 'rgba(255,255,255,0.4)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)', flexShrink: 0 }} />
                  </button>
                  {/* Cuerpo con animación de altura suave */}
                  <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <p className="rk-body" style={{ margin: 0, padding: '0 22px 22px 74px', fontSize: '0.95rem', lineHeight: 1.7 }}>
                        {t(item.a)}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Cierre: aún con dudas → crear cuenta / cómo funciona */}
        <Reveal delay={120}>
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <p className="rk-body" style={{ marginBottom: 16 }}>{t('faq_still')}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="rk-btn rk-btn-primary" style={{ padding: '0.95rem 2.4rem' }} onClick={() => navigate('/auth')}>
                {t('btn_start_free')} →
              </button>
              <button className="rk-btn rk-btn-ghost" style={{ padding: '0.95rem 2rem' }} onClick={() => navigate('/como-funciona')}>
                {t('faq_how_cta')}
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

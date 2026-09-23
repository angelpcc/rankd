import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/base/Reveal';
import SectionHead from '@/components/base/SectionHead';

// Preguntas reales que cubren los cuatro perfiles (peleador, promotora, marca
// y afición). Respuestas honestas con la voz de RANKD: directo y sin humo.
//
// ── v4: DE COLUMNA A DOS COLUMNAS ──
//
// Eran ocho tarjetas altas en una columna de 900 px, con la primera abierta: la
// sección ocupaba 1.500 px de la portada. Ahora, en el ordenador, la cabecera y
// el "¿sigues con dudas?" van a la izquierda (fijos al bajar) y las preguntas a
// la derecha, en filas compactas y cerradas de entrada: se lee la lista de un
// vistazo y se abre la que interesa.
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
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="rk-viewport-section" style={{ position: 'relative', background: 'var(--rk-black)', overflow: 'hidden' }}>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-8 lg:gap-14 items-start">
          {/* Cabecera y cierre, a la izquierda */}
          <Reveal className="lg:sticky lg:top-28">
            <SectionHead eyebrow={t('faq_eyebrow')} title={t('faq_headline_1')} highlight={t('faq_headline_2')} sub={t('faq_subtext')} />
            <div className="hidden lg:block">
              <p className="text-sm mb-3" style={{ color: 'var(--t-2)' }}>{t('faq_still')}</p>
              <div className="flex gap-2.5 flex-wrap">
                <button className="rk-btn rk-btn-primary" onClick={() => navigate('/auth')}>{t('btn_start_free')}</button>
                <button className="rk-btn rk-btn-ghost" onClick={() => navigate('/como-funciona')}>{t('faq_how_cta')}</button>
              </div>
            </div>
          </Reveal>

          {/* Preguntas */}
          <div className="rk-card" style={{ padding: 6 }}>
            {ITEMS.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} style={{ borderTop: i > 0 ? '1px solid var(--line)' : undefined }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-3.5 text-left cursor-pointer rounded-xl transition-colors hover:bg-white/[0.03]"
                    style={{ padding: '16px 14px' }}
                  >
                    <span className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: isOpen ? 'rgba(225,6,0,0.14)' : 'rgba(255,255,255,0.045)', color: isOpen ? '#E10600' : 'rgba(255,255,255,0.6)' }}>
                      <i className={item.icon} />
                    </span>
                    <span className="flex-1 text-[15px] font-semibold" style={{ color: isOpen ? '#fff' : 'var(--t-1)' }}>
                      {t(item.q)}
                    </span>
                    <i className="ri-add-line text-xl flex-shrink-0" style={{ color: isOpen ? '#E10600' : 'var(--t-3)', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)' }} />
                  </button>
                  {/* Cuerpo con animación de altura suave */}
                  <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.35s cubic-bezier(0.22,1,0.36,1)' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <p className="text-[15px] leading-relaxed" style={{ margin: 0, padding: '0 16px 18px 64px', color: 'var(--t-2)' }}>
                        {t(item.a)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* En el móvil, el cierre va debajo de las preguntas. */}
        <div className="lg:hidden mt-8 text-center">
          <p className="text-sm mb-3" style={{ color: 'var(--t-2)' }}>{t('faq_still')}</p>
          <div className="flex gap-2.5 flex-wrap justify-center">
            <button className="rk-btn rk-btn-primary" onClick={() => navigate('/auth')}>{t('btn_start_free')}</button>
            <button className="rk-btn rk-btn-ghost" onClick={() => navigate('/como-funciona')}>{t('faq_how_cta')}</button>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// R12-T15: CTA de cierre de la landing ("Únete desde el principio"). Antes
// vivía junto a los beneficios; se separó para que la narrativa fluya
// (los beneficios van arriba, la llamada a la acción cierra).
//
// v4: una franja con el lenguaje del resto (Inter, botón de la casa) en vez de
// un titular Bebas de 90 px con la segunda línea en letra de contorno casi
// invisible y un botón con brillo pulsante. Cerrar con calma convence más que
// cerrar gritando.
export default function Partners() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible')); }),
      { threshold: 0.08 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="join" ref={sectionRef} className="rk-viewport-section" style={{ background: '#050505', position: 'relative' }}>
      <div className="reveal" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div className="relative overflow-hidden rounded-3xl"
          style={{ background: 'radial-gradient(600px 300px at 0% 0%, rgba(225,6,0,0.18), transparent 70%), linear-gradient(180deg, #141416, #0e0e10)', border: '1px solid var(--line-2)' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 p-7 sm:p-10 md:p-12">
            <div className="min-w-0 max-w-xl">
              <p className="rk-head-eyebrow" style={{ color: 'var(--accent)' }}><span aria-hidden className="rk-head-dash" />{t('partners_cta_eyebrow')}</p>
              <h3 className="rk-head-title">{t('partners_cta_headline_1')} <span style={{ color: 'var(--t-3)' }}>{t('partners_cta_headline_2')}</span></h3>
              <p className="rk-head-sub">{t('partners_cta_desc')}</p>
            </div>
            <div className="flex flex-col gap-2.5 md:items-end flex-shrink-0">
              <button className="rk-btn rk-btn-primary" style={{ padding: '1rem 1.8rem', fontSize: '1rem' }} onClick={() => navigate('/auth')}>
                {t('partners_cta_btn')} <i className="ri-arrow-right-line" />
              </button>
              <span className="text-xs md:text-right" style={{ color: 'var(--t-3)' }}>{t('partners_cta_note')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

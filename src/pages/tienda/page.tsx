import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';

// Lo que se está preparando. Sin fotos falsas de producto: se cuenta qué viene
// y con qué criterio, que es lo honesto mientras no exista el catálogo.
const DROPS = [
  { icon: 'ri-t-shirt-line', nameKey: 'tnd_drop1_name', descKey: 'tnd_drop1_desc' },
  { icon: 'ri-shirt-line', nameKey: 'tnd_drop2_name', descKey: 'tnd_drop2_desc' },
  { icon: 'ri-handbag-line', nameKey: 'tnd_drop3_name', descKey: 'tnd_drop3_desc' },
  { icon: 'ri-cup-line', nameKey: 'tnd_drop4_name', descKey: 'tnd_drop4_desc' },
];

export default function StorePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'duplicate' | 'error'>('idle');

  useSEO({
    title: 'Tienda | RANKD',
    description: 'Merchandising oficial de RANKD para deportes de contacto. Apúntate y te avisamos cuando abra.',
  });

  const notifyMe = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setStatus('error'); return; }
    setStatus('sending');
    const { error } = await supabase.from('waitlist').insert({ email: clean });
    if (error) { setStatus(error.code === '23505' ? 'duplicate' : 'error'); return; }
    setStatus('done');
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />

      {/* ══════ CABECERA ══════ */}
      <section className="relative overflow-hidden pb-10" style={{ paddingTop: 'calc(7rem + env(safe-area-inset-top, 0px))' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.11) 0%, transparent 58%)' }} />
        <div className="absolute inset-0 rk-grid-bg pointer-events-none opacity-40" />
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C 50%, transparent)' }} />

        <div className="relative max-w-5xl mx-auto px-5 text-center">
          <div className="inline-flex items-center gap-2.5 mb-5 px-4 py-1.5 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/[0.07]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]"></span>
            <span className="text-[#C9A84C] text-xs font-bold tracking-[0.25em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{t('tnd_badge')}</span>
          </div>

          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(42px, 9vw, 86px)', lineHeight: 0.88, color: 'white', letterSpacing: 1 }}>
            {t('tnd_title').toUpperCase()} <span style={{ color: '#C9A84C', textShadow: '0 0 45px rgba(201,168,76,0.45)' }}>RANKD</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg max-w-lg mx-auto" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'rgba(255,255,255,0.65)' }}>
            {t('tnd_hero_sub')}
          </p>
        </div>
      </section>

      {/* ══════ QUÉ VIENE ══════ */}
      <section className="max-w-5xl mx-auto px-5 pb-4">
        <div className="flex items-center gap-3.5 mb-5">
          <span className="rk-index">{t('tnd_workshop')}</span>
          <span className="flex-1 h-px bg-white/[0.09]" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3.5">
          {DROPS.map((d, i) => (
            <div key={d.nameKey} className={`rk-card p-5 flex items-start gap-4 anim-fade-up anim-d${i + 1}`}>
              <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C]">
                <i className={`${d.icon} text-xl`}></i>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{t(d.nameKey)}</p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t(d.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ AVISO DE APERTURA ══════ */}
      <section className="max-w-5xl mx-auto px-5 py-10">
        <div className="rk-card p-7 sm:p-9 text-center relative overflow-hidden" style={{ transform: 'none' }}>
          <div className="rk-glow-gold" style={{ width: 340, height: 340, top: -170, left: '50%', marginLeft: -170, borderRadius: '50%' }} />
          <div className="relative">
            <i className="ri-mail-star-line text-3xl text-[#C9A84C]"></i>
            <h2 className="rk-h3 mt-3" style={{ color: '#fff' }}>{t('tnd_notify_title')}</h2>
            <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
              {t('tnd_notify_desc')}
            </p>

            {status === 'done' || status === 'duplicate' ? (
              <div className="mt-6 inline-flex items-center gap-2.5 bg-green-500/[0.08] border border-green-500/30 rounded-xl px-5 py-3.5">
                <i className="ri-check-double-line text-green-400"></i>
                <span className="text-sm text-green-300">
                  {status === 'duplicate' ? t('tnd_dup') : t('tnd_done')}
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto mt-6">
                  <input
                    type="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') notifyMe(); }}
                    placeholder="tu@email.com" aria-label={t('tnd_aria_email')}
                    className="flex-1 bg-white/[0.04] border border-white/12 text-white text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                  />
                  <button onClick={notifyMe} disabled={status === 'sending'}
                    className="rk-btn rk-btn-gold whitespace-nowrap disabled:opacity-60" style={{ fontSize: '0.95rem', padding: '0.9rem 1.8rem' }}>
                    {status === 'sending' ? t('tnd_sending') : t('tnd_notify_btn')}
                  </button>
                </div>
                {status === 'error' && (
                  <p className="text-red-400 text-xs mt-3">{t('tnd_email_error')}</p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ══════ MIENTRAS TANTO ══════ */}
      <section className="max-w-5xl mx-auto px-5 pb-20">
        <div className="flex items-center gap-3.5 mb-5">
          <span className="rk-index">{t('tnd_meanwhile')}</span>
          <span className="flex-1 h-px bg-white/[0.09]" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3.5">
          <button onClick={() => navigate('/brands')} className="rk-card p-6 text-left cursor-pointer group">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400 mb-3.5">
              <i className="ri-store-2-line text-xl"></i>
            </div>
            <p className="text-base font-bold text-white">{t('tnd_brands_title')}</p>
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
              {t('tnd_brands_desc')}
            </p>
            <p className="text-sm font-bold text-red-400 mt-4 flex items-center gap-1 group-hover:gap-2.5 transition-all">
              {t('tnd_brands_cta')} <i className="ri-arrow-right-line"></i>
            </p>
          </button>

          <button onClick={() => navigate('/mi-esquina')} className="rk-card p-6 text-left cursor-pointer group">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#C9A84C]/12 border border-[#C9A84C]/30 text-[#C9A84C] mb-3.5">
              <i className="ri-boxing-line text-xl"></i>
            </div>
            <p className="text-base font-bold text-white">{t('tnd_guide_title')}</p>
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
              {t('tnd_guide_desc')}
            </p>
            <p className="text-sm font-bold text-[#C9A84C] mt-4 flex items-center gap-1 group-hover:gap-2.5 transition-all">
              {t('tnd_guide_cta')} <i className="ri-arrow-right-line"></i>
            </p>
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

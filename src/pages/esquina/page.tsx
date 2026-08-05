import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';

// Vista previa pública de "Mi Esquina" — bloqueada hasta crear cuenta
export default function EsquinaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  useSEO({
    title: 'Mi Esquina — Tu diario de entrenamiento | RANKD',
    description: 'Registra tus entrenamientos, mantén tu racha, consulta a tu Coach IA y lleva tu preparación al siguiente nivel. Gratis en RANKD.',
  });

  const goCta = () => navigate(user ? '/mi-esquina' : '/auth');

  const previewSessions = [
    { id: 'sparring', icon: 'ri-boxing-line', label: t('esl_ps_sparring'), time: '90 min', fire: 4, note: t('esl_ps_sparring_note') },
    { id: 'cardio', icon: 'ri-run-line', label: t('esl_ps_cardio'), time: '45 min', fire: 3, note: t('esl_ps_cardio_note') },
    { id: 'strength', icon: 'ri-hammer-line', label: t('esl_ps_strength'), time: '60 min', fire: 4, note: t('esl_ps_strength_note') },
    { id: 'technique', icon: 'ri-focus-3-line', label: t('esl_ps_technique'), time: '75 min', fire: 2, note: t('esl_ps_technique_note') },
  ];

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />

      {/* HERO */}
      <section className="relative pb-10 overflow-hidden" style={{ paddingTop: 'calc(7rem + env(safe-area-inset-top, 0px))' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(225,6,0,0.12) 0%, transparent 55%)' }} />
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #E10600 50%, transparent)' }} />
        <div className="relative max-w-5xl mx-auto px-5 text-center">
          <div className="inline-flex items-center gap-2.5 mb-6 px-5 py-2 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/[0.08] anim-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" style={{ boxShadow: '0 0 10px #C9A84C' }}></span>
            <span className="text-[#C9A84C] text-xs font-bold tracking-[0.3em] uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{t('esl_members')}</span>
          </div>
          <h1 className="anim-fade-up anim-d2" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(44px, 9vw, 90px)', lineHeight: 0.9, color: 'white', letterSpacing: 1 }}>
            {t('esl_title_1')} <span style={{ color: '#E10600', textShadow: '0 0 50px rgba(225,6,0,0.5)' }}>{t('esl_title_2')}</span>
          </h1>
          <p className="anim-fade-up anim-d3 mx-auto mt-4 max-w-xl text-base sm:text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            {t('esl_sub')}
          </p>
          <button onClick={goCta} className="anim-fade-up anim-d4 mt-8 px-10 py-4 rounded-xl cursor-pointer transition-all"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 3, color: 'white', background: 'linear-gradient(135deg, #E10600, #c00)', border: 'none', boxShadow: '0 8px 40px rgba(225,6,0,0.5)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}>
            {user ? t('esl_cta_go') : t('esl_cta_join')}
          </button>
        </div>
      </section>

      {/* PREVIEW BLOQUEADA */}
      <section className="relative max-w-4xl mx-auto px-5 pb-16">
        <div className="relative rounded-3xl overflow-hidden border border-zinc-800">
          {/* Contenido difuminado (decorativo) */}
          <div className="p-6 sm:p-8 space-y-5 select-none pointer-events-none" style={{ filter: 'blur(7px)', opacity: 0.55 }} aria-hidden="true">
            <div className="grid grid-cols-3 gap-3">
              {[{ v: '12', l: t('esl_stat_streak'), c: 'text-orange-400' }, { v: '5', l: t('esl_stat_week_sessions'), c: 'text-white' }, { v: '6h 45m', l: t('esl_stat_week_time'), c: 'text-green-400' }].map((s) => (
                <div key={s.l} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
                  <p className={`text-3xl font-black ${s.c}`}>{s.v}</p>
                  <p className="text-xs text-zinc-400 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {previewSessions.map((s) => (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/25 text-red-400"><i className={`${s.icon} text-lg`}></i></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{s.label} <span className="text-xs text-zinc-500 font-normal">· {s.time}</span></p>
                    <p className="text-xs text-zinc-500">{s.note}</p>
                  </div>
                  <span className="flex gap-0.5 text-red-400 text-xs">{Array.from({ length: s.fire }).map((_, i) => <i key={i} className="ri-fire-fill"></i>)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Overlay de bloqueo */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-transparent via-[#050505]/60 to-[#050505]" >
            <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-zinc-900/90 border border-zinc-700 backdrop-blur anim-float">
              <i className="ri-lock-2-line text-2xl text-[#C9A84C]"></i>
            </div>
            <p className="text-white font-bold text-lg text-center px-6" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>{t('esl_unlock_title')}</p>
            <button onClick={goCta} className="px-7 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer transition-colors shadow-lg shadow-red-600/40">
              {user ? t('esl_unlock_go') : t('esl_unlock_free')}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          {[
            { id: 'diary', icon: 'ri-calendar-check-line', title: t('esl_f1_title'), desc: t('esl_f1_desc') },
            { id: 'progress', icon: 'ri-fire-line', title: t('esl_f2_title'), desc: t('esl_f2_desc') },
            { id: 'ai', icon: 'ri-sparkling-2-line', title: t('esl_f3_title'), desc: t('esl_f3_desc'), soon: true },
            { id: 'everyone', icon: 'ri-heart-pulse-line', title: t('esl_f4_title'), desc: t('esl_f4_desc') },
          ].map((f, i) => (
            <div key={f.id} className={`bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 anim-fade-up anim-d${i + 1}`}>
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/10 border border-red-500/25 text-red-400 mb-3"><i className={`${f.icon} text-lg`}></i></div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">{f.title}</h3>
                {f.soon && <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded-full uppercase">{t('esl_soon')}</span>}
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
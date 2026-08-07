import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/admin';
import { useSEO } from '@/hooks/useSEO';
import VideoStudio from './video/VideoStudio';
import PublicationStudio from './publication/PublicationStudio';
import MessageStudio from './message/MessageStudio';

type StudioTab = 'entry' | 'videos' | 'publications' | 'messages';

const TABS: { id: Exclude<StudioTab, 'entry'>; label: string; icon: string; color: string }[] = [
  { id: 'videos', label: 'Vídeos', icon: 'ri-movie-2-line', color: '#E10600' },
  { id: 'publications', label: 'Publicaciones', icon: 'ri-image-2-line', color: '#C9A84C' },
  { id: 'messages', label: 'Mensajes', icon: 'ri-message-3-line', color: '#38bdf8' },
];

/**
 * Fábrica de contenido de RANKD. Solo Ángel (isAdminEmail) puede entrar —
 * gating inline, mismo patrón que /admin (sin wrapper de ruta).
 */
export default function CreatorStudioPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<StudioTab>('entry');
  const isAdmin = isAdminEmail(user?.email);

  useSEO({ title: 'Creator Studio | RANKD', description: 'Fábrica de contenido de RANKD.' });

  if (authLoading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/30 mb-5">
          <i className="ri-lock-2-line text-2xl text-red-400"></i>
        </div>
        <h1 className="text-white text-xl font-bold">Acceso restringido</h1>
        <p className="text-zinc-500 text-sm mt-2">Creator Studio es solo para administradores de RANKD.</p>
        <button onClick={() => navigate('/beta')} className="mt-6 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-6 py-3 rounded-xl cursor-pointer transition-colors">Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 rk-safe-top">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => (tab === 'entry' ? navigate('/admin') : setTab('entry'))} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <i className="ri-arrow-left-line"></i> {tab === 'entry' ? 'Admin' : 'Creator Studio'}
          </button>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 3 }}>CREATOR</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, letterSpacing: 3 }} className="text-[#E10600]">STUDIO</span>
          </div>
          <span className="w-9" />
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-5 pb-16" style={{ paddingTop: 'calc(5.5rem + env(safe-area-inset-top, 0px))' }}>
        {tab === 'entry' ? (
          <div className="space-y-8">
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
                FÁBRICA DE <span className="rk-red-glow">CONTENIDO</span>
              </h1>
              <p className="text-zinc-400 text-sm mt-2">Genera vídeos, publicaciones y mensajes con IA, con el contexto de marca de RANKD siempre aplicado.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className="rk-card p-6 text-left cursor-pointer group">
                  <div className="w-12 h-12 flex items-center justify-center rounded-2xl border mb-4" style={{ background: `${t.color}14`, borderColor: `${t.color}40`, color: t.color }}>
                    <i className={`${t.icon} text-2xl`}></i>
                  </div>
                  <p className="text-lg font-bold text-white">{t.label}</p>
                  <p className="text-xs font-bold mt-3 flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: t.color }}>
                    Abrir <i className="ri-arrow-right-line"></i>
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="sm:hidden mb-6">
              <select value={tab} onChange={(e) => setTab(e.target.value as StudioTab)}
                style={{ fontSize: 16, minHeight: 44 }}
                className="w-full appearance-none bg-white/[0.04] border border-white/12 text-white font-semibold rounded-xl pl-4 pr-10 cursor-pointer">
                {TABS.map((t) => <option key={t.id} value={t.id} className="bg-zinc-900">{t.label}</option>)}
              </select>
            </div>
            <div className="hidden sm:flex gap-2 mb-8">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border transition-all ${tab === t.id ? 'text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}
                  style={tab === t.id ? { background: t.color, borderColor: t.color } : undefined}>
                  <i className={t.icon}></i>{t.label}
                </button>
              ))}
            </div>

            {tab === 'videos' && <VideoStudio />}
            {tab === 'publications' && <PublicationStudio />}
            {tab === 'messages' && <MessageStudio />}
          </div>
        )}
      </main>
    </div>
  );
}

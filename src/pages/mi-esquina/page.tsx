import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import FighterTraining from '@/pages/dashboard/components/FighterTraining';
import MessagesPanel from '@/pages/dashboard/components/messages/MessagesPanel';
import RoundTimer from '@/pages/mi-esquina/components/RoundTimer';
import WeeklyPlanner from '@/pages/mi-esquina/components/WeeklyPlanner';

type Section = 'resumen' | 'diario' | 'rutina' | 'timer' | 'coach' | 'material' | 'nutricion' | 'mensajes';

const SECTIONS: { id: Section; label: string; icon: string; soon?: boolean }[] = [
  { id: 'resumen', label: 'Resumen', icon: 'ri-dashboard-line' },
  { id: 'diario', label: 'Diario de entrenos', icon: 'ri-calendar-check-line' },
  { id: 'rutina', label: 'Mi semana', icon: 'ri-calendar-2-line' },
  { id: 'timer', label: 'Temporizador', icon: 'ri-timer-flash-line' },
  { id: 'coach', label: 'Coach IA', icon: 'ri-sparkling-2-line', soon: true },
  { id: 'material', label: 'Material', icon: 'ri-boxing-line' },
  { id: 'nutricion', label: 'Nutrición', icon: 'ri-restaurant-line' },
  { id: 'mensajes', label: 'Mensajes', icon: 'ri-message-3-line' },
];

const GEAR = [
  { icon: 'ri-boxing-line', title: 'Guantes', tips: ['Entrenamiento en saco: 12-14 oz', 'Sparring: 16 oz (protege a ti y a tu compañero)', 'Competición amateur: 10-12 oz según categoría', 'Busca cierre de velcro para el día a día y ajuste firme en la muñeca'] },
  { icon: 'ri-hand-heart-line', title: 'Vendas', tips: ['Imprescindibles SIEMPRE, incluso con guantes buenos', 'Semielásticas de 4,5 m para adultos', 'Envuelve muñeca, nudillos y pulgar', 'Lávalas a menudo: el sudor las degrada'] },
  { icon: 'ri-emotion-normal-line', title: 'Bucal', tips: ['Obligatorio en sparring y competición', 'Los termomoldeables son la mejor relación calidad/precio', 'Moldéalo bien siguiendo las instrucciones (agua caliente)', 'Llévalo también en técnica con contacto'] },
  { icon: 'ri-shield-line', title: 'Protecciones', tips: ['Casco para sparring: mejor con protección en pómulos', 'Coquilla obligatoria en sparring', 'Espinilleras para kickboxing y muay thai', 'Revisa el estado del acolchado cada pocos meses'] },
  { icon: 'ri-footprint-line', title: 'Calzado', tips: ['Boxeo: bota alta con suela fina para pivotar', 'MMA: descalzo, entrena la fuerza del pie', 'Evita zapatillas de running en el ring: demasiada amortiguación', 'La suela debe agarrar sin frenar el giro'] },
  { icon: 'ri-t-shirt-line', title: 'Extras que suman', tips: ['Cuerda de saltar con rodamientos: cardio específico', 'Comba de velocidad cuando domines la básica', 'Esterilla para movilidad y core', 'Bolsa de deporte ventilada (tu equipo lo agradece)'] },
];

const NUTRITION = [
  { icon: 'ri-drop-line', title: 'Hidratación', body: 'Bebe agua durante todo el día, no solo al entrenar. En sesiones largas o con mucho sudor, añade electrolitos. Llegar deshidratado al entreno reduce tu rendimiento de forma directa.' },
  { icon: 'ri-restaurant-2-line', title: 'Antes de entrenar', body: 'Come 1,5-2 horas antes: carbohidratos de absorción media (arroz, avena, pasta, fruta) y algo de proteína. Evita comidas muy grasas justo antes: ralentizan la digestión.' },
  { icon: 'ri-flashlight-line', title: 'Después de entrenar', body: 'La ventana post-entreno es clave: proteína (pollo, huevos, pescado, batido) + carbohidratos para recargar. No hace falta nada raro: comida real y suficiente.' },
  { icon: 'ri-scales-2-line', title: 'Peso y competición', body: 'Si compites, no dejes el corte de peso para el final. Trabaja tu peso de forma gradual con un profesional. Los cortes agresivos de última hora destrozan tu rendimiento y tu salud.' },
  { icon: 'ri-capsule-line', title: 'Suplementación básica', body: 'Lo que tiene evidencia real: creatina monohidrato (fuerza), proteína en polvo (comodidad), cafeína (rendimiento) y omega-3. Todo lo demás, con escepticismo. Primero la comida, luego los botes.' },
  { icon: 'ri-moon-line', title: 'El suplemento gratis: dormir', body: '7-9 horas. El sueño es donde asimilas el entrenamiento, recuperas y consolidas técnica. Entrenar mucho durmiendo poco es entrenar a medias.' },
];

export default function MiEsquinaPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [section, setSection] = useState<Section>('resumen');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState({ total: 0, week: 0, weekMin: 0 });

  useSEO({
    title: 'Mi Esquina | RANKD',
    description: 'Tu espacio de entrenamiento en RANKD: diario, rutinas, material y nutrición.',
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/esquina');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('training_sessions')
        .select('session_date, duration_min')
        .eq('fighter_profile_id', profile.id);
      if (!data) return;
      const now = new Date();
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - day);
      weekStart.setHours(0, 0, 0, 0);
      const week = data.filter((s) => new Date(s.session_date + 'T12:00:00') >= weekStart);
      setStats({ total: data.length, week: week.length, weekMin: week.reduce((a, s) => a + (s.duration_min || 0), 0) });
    };
    load();
  }, [profile?.id, section]);

  if (authLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isHobby = profile.athlete_mode === 'hobby';
  const firstName = (profile.full_name || '').split(' ')[0] || 'campeón';

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Top bar propia */}
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate(isHobby ? '/beta' : '/dashboard')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <i className="ri-arrow-left-line"></i>
            <span className="hidden sm:inline">{isHobby ? 'Inicio' : 'Mi Dashboard'}</span>
          </button>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3 }} className="text-white">MI</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 3 }} className="text-[#E10600]">ESQUINA</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-0.5"></span>
          </div>
          <a href="/beta" className="flex items-center gap-0 cursor-pointer">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[15px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[15px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-20 lg:bottom-6 right-6 z-50 text-white text-sm px-5 py-3 rounded-xl flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          <i className={toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'}></i>{toast.msg}
        </div>
      )}

      <div className="pt-14 flex min-h-screen max-w-[1400px] mx-auto">
        {/* Sidebar propia (desktop) */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-zinc-800/70 py-6 px-3 sticky top-14 h-[calc(100vh-3.5rem)]">
          <nav className="space-y-1 flex-1">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${section === s.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/25' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'}`}>
                <i className={`${s.icon} text-base flex-shrink-0`}></i>
                <span className="flex-1">{s.label}</span>
                {s.soon && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${section === s.id ? 'bg-white/20 text-white' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/25'}`}>Pronto</span>}
              </button>
            ))}
          </nav>
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800">
            <p className="text-xs font-bold text-white flex items-center gap-1.5"><i className="ri-fire-line text-orange-400"></i>Sigue así, {firstName}</p>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">La constancia gana más combates que el talento.</p>
          </div>
        </aside>

        {/* Tabs móvil */}
        <div className="lg:hidden fixed top-14 left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 overflow-x-auto">
          <div className="flex px-3 py-2 gap-1 min-w-max">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${section === s.id ? 'bg-red-600 text-white' : 'text-zinc-400'}`}>
                <i className={s.icon}></i>{s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 pt-24 lg:pt-8 pb-16 min-w-0">

          {section === 'resumen' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
                  BIENVENIDO A TU <span className="text-[#E10600]">ESQUINA</span>, {firstName.toUpperCase()}
                </h1>
                <p className="text-zinc-400 text-sm mt-2">{isHobby ? 'Tu espacio de entrenamiento. Sin competir, pero con la misma disciplina.' : 'Todo lo que necesitas para entrenar mejor, en un solo sitio.'}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 text-center">
                  <p className="text-2xl sm:text-3xl font-black text-white">{stats.total}</p>
                  <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">Sesiones totales</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 text-center">
                  <p className="text-2xl sm:text-3xl font-black text-red-400">{stats.week}</p>
                  <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">Esta semana</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 text-center">
                  <p className="text-2xl sm:text-3xl font-black text-green-400">{stats.weekMin >= 60 ? `${Math.floor(stats.weekMin / 60)}h` : `${stats.weekMin}m`}</p>
                  <p className="text-[11px] sm:text-xs text-zinc-400 mt-1">Tiempo semanal</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { s: 'diario' as Section, icon: 'ri-calendar-check-line', title: 'Registra tu entreno de hoy', desc: 'Suma a tu racha y controla tu carga semanal', cta: 'Ir al diario' },
                  { s: 'timer' as Section, icon: 'ri-timer-flash-line', title: 'Temporizador de asaltos', desc: 'Entrena con el ritmo real del combate, con campana', cta: 'Abrir timer' },
                  { s: 'rutina' as Section, icon: 'ri-calendar-2-line', title: 'Planifica tu semana', desc: 'Organiza tus entrenos y ve tachando lo cumplido', cta: 'Ver mi semana' },
                  { s: 'material' as Section, icon: 'ri-boxing-line', title: 'Guía de material', desc: 'Guantes, vendas, protecciones: qué comprar y por qué', cta: 'Ver guía' },
                  { s: 'nutricion' as Section, icon: 'ri-restaurant-line', title: 'Nutrición del peleador', desc: 'Lo esencial para rendir: comida, hidratación y descanso', cta: 'Ver consejos' },
                  { s: 'coach' as Section, icon: 'ri-sparkling-2-line', title: 'Coach IA', desc: 'Tu entrenador personal inteligente está en camino', cta: 'Saber más' },
                ].map((c) => (
                  <button key={c.title} onClick={() => setSection(c.s)} className="text-left bg-zinc-900 border border-zinc-800 hover:border-red-500/40 rounded-2xl p-5 transition-colors cursor-pointer group">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400 mb-3"><i className={`${c.icon} text-lg`}></i></div>
                    <p className="text-sm font-bold text-white">{c.title}</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{c.desc}</p>
                    <p className="text-xs font-bold text-red-400 mt-3 flex items-center gap-1 group-hover:gap-2 transition-all">{c.cta} <i className="ri-arrow-right-line"></i></p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {section === 'diario' && <FighterTraining profile={profile} showToast={showToast} />}

          {section === 'mensajes' && <div className="max-w-5xl"><MessagesPanel currentUserId={profile.id} /></div>}

          {section === 'rutina' && <WeeklyPlanner profile={profile} showToast={showToast} />}

          {section === 'timer' && <RoundTimer />}

          {section === 'coach' && (
            <div className="max-w-2xl text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-3xl bg-red-600/10 border border-red-500/30 anim-pulse-glow" style={{ borderRadius: 24 }}>
                <i className="ri-sparkling-2-line text-3xl text-red-400"></i>
              </div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2 }}>COACH IA <span className="text-[#E10600]">MUY PRONTO</span></h2>
              <p className="text-zinc-400 text-sm mt-3 max-w-md mx-auto leading-relaxed">
                Un entrenador con inteligencia artificial que conocerá tu perfil, tu récord y tu diario. Pregúntale sobre planificación, estrategia, preparación de combates o cualquier duda de tu deporte. Disponible las 24 horas, en tu esquina.
              </p>
              <div className="mt-8 grid sm:grid-cols-3 gap-3 text-left">
                {[
                  { icon: 'ri-question-answer-line', t: 'Pregunta lo que sea', d: '"¿Cómo mejoro mi jab?" "¿Qué entreno si me duele el hombro?"' },
                  { icon: 'ri-calendar-2-line', t: 'Planifica contigo', d: 'Te ayudará a organizar tu semana según tus objetivos' },
                  { icon: 'ri-user-heart-line', t: 'Te conoce', d: 'Sabe tu disciplina, nivel y cómo vienes entrenando' },
                ].map((f) => (
                  <div key={f.t} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <i className={`${f.icon} text-red-400 text-lg`}></i>
                    <p className="text-xs font-bold text-white mt-2">{f.t}</p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{f.d}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'material' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', letterSpacing: 1 }}>GUÍA DE <span className="text-[#E10600]">MATERIAL</span></h1>
                <p className="text-zinc-400 text-sm mt-1">Qué necesitas de verdad para entrenar deportes de contacto, sin humo.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {GEAR.map((g, i) => (
                  <div key={g.title} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 anim-fade-up anim-d${(i % 6) + 1}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400"><i className={`${g.icon} text-lg`}></i></div>
                      <h3 className="text-base font-bold text-white">{g.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {g.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-xs text-zinc-400 leading-relaxed">
                          <i className="ri-check-line text-red-400 mt-0.5 flex-shrink-0"></i>{tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600">Consejo general orientativo. Consulta siempre con tu entrenador para tu caso concreto.</p>
            </div>
          )}

          {section === 'nutricion' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', letterSpacing: 1 }}>NUTRICIÓN DEL <span className="text-[#E10600]">PELEADOR</span></h1>
                <p className="text-zinc-400 text-sm mt-1">Los básicos que marcan la diferencia. Sin milagros, sin humo.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {NUTRITION.map((n, i) => (
                  <div key={n.title} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 anim-fade-up anim-d${(i % 6) + 1}`}>
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500/10 border border-green-500/25 text-green-400"><i className={`${n.icon} text-lg`}></i></div>
                      <h3 className="text-base font-bold text-white">{n.title}</h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{n.body}</p>
                  </div>
                ))}
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-start gap-3">
                <i className="ri-information-line text-zinc-500 mt-0.5"></i>
                <p className="text-[11px] text-zinc-500 leading-relaxed">Contenido informativo general, no sustituye el consejo de un médico o dietista-nutricionista. Si compites o tienes objetivos de peso, trabaja con un profesional.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
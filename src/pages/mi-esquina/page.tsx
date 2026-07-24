import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSEO } from '@/hooks/useSEO';
import FighterTraining from '@/pages/dashboard/components/FighterTraining';
import MessagesPanel from '@/pages/dashboard/components/messages/MessagesPanel';
import RoundTimer from '@/pages/mi-esquina/components/RoundTimer';
import WeeklyPlanner from '@/pages/mi-esquina/components/WeeklyPlanner';
import NutritionTracker from '@/pages/mi-esquina/components/NutritionTracker';
import GearChecklist from '@/pages/mi-esquina/components/GearChecklist';
import SectionCoach from '@/pages/mi-esquina/components/SectionCoach';
import MealLog from '@/pages/mi-esquina/components/MealLog';
import Reveal from '@/components/base/Reveal';
import NotificationBell from '@/components/feature/NotificationBell';

type Section = 'resumen' | 'diario' | 'rutina' | 'timer' | 'coach' | 'material' | 'nutricion' | 'mensajes';

const SECTIONS: { id: Section; label: string; icon: string; soon?: boolean }[] = [
  { id: 'resumen', label: 'Resumen', icon: 'ri-dashboard-line' },
  { id: 'diario', label: 'Diario de entrenos', icon: 'ri-calendar-check-line' },
  { id: 'rutina', label: 'Mi semana', icon: 'ri-calendar-2-line' },
  { id: 'timer', label: 'Temporizador', icon: 'ri-timer-flash-line' },
  { id: 'coach', label: 'Coach IA', icon: 'ri-sparkling-2-line' },
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
  const [stats, setStats] = useState({ total: 0, week: 0, weekMin: 0, todayLogged: false, streak: 0, lastWeekMin: 0 });

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
      const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const week = data.filter((s) => new Date(s.session_date + 'T12:00:00') >= weekStart);
      const lastWeek = data.filter((s) => { const dt = new Date(s.session_date + 'T12:00:00'); return dt >= lastWeekStart && dt < weekStart; });
      const days = new Set(data.map((s) => s.session_date));
      const todayLogged = days.has(iso(now));
      // Racha de días consecutivos (si hoy no hay, cuenta desde ayer)
      let streak = 0;
      const cursor = new Date(now);
      if (!todayLogged) cursor.setDate(cursor.getDate() - 1);
      for (;;) { if (days.has(iso(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); } else break; }
      setStats({
        total: data.length,
        week: week.length,
        weekMin: week.reduce((a, s) => a + (s.duration_min || 0), 0),
        lastWeekMin: lastWeek.reduce((a, s) => a + (s.duration_min || 0), 0),
        todayLogged,
        streak,
      });
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
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 rk-safe-top">
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
          <div className="flex items-center gap-2.5">
            {/* Aquí es donde importa: los recordatorios de entreno se generan al entrar. */}
            <NotificationBell userId={profile.id} reminders />
            <a href="/beta" className="hidden sm:flex items-center gap-0 cursor-pointer">
              <span className="font-unbounded font-black tracking-tighter leading-none text-[15px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
              <span className="font-unbounded font-black tracking-tighter leading-none text-[15px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
            </a>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-20 lg:bottom-6 right-6 z-50 text-white text-sm px-5 py-3 rounded-xl flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          <i className={toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'}></i>{toast.msg}
        </div>
      )}

      <div className="flex min-h-screen max-w-[1400px] mx-auto" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        {/* Sidebar propia (desktop) */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-zinc-800/70 py-6 px-3 sticky h-[calc(100vh-3.5rem)]" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
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
        <div className="lg:hidden fixed left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 overflow-x-auto" style={{ top: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
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
              {/* Hábito diario: aviso o resumen según si ya entrenó hoy */}
              <Reveal>
                {stats.todayLogged ? (
                  <div className="rk-card relative overflow-hidden" style={{ padding: '18px 20px', borderColor: 'rgba(34,197,94,0.25)' }}>
                    <div className="rk-glow-red" style={{ width: 160, height: 160, top: -70, right: -50, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.14) 0%, transparent 68%)' }} />
                    <div className="relative flex items-center gap-4">
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-green-500/12 border border-green-500/30 text-green-400"><i className="ri-check-double-line text-2xl"></i></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">Entreno de hoy registrado 🔥</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {stats.streak > 1 ? `Racha de ${stats.streak} días. ` : ''}Esta semana: {stats.week} {stats.week === 1 ? 'sesión' : 'sesiones'}
                          {stats.lastWeekMin > 0 && (
                            <span className={stats.weekMin >= stats.lastWeekMin ? 'text-green-400' : 'text-orange-400'}> · {stats.weekMin >= stats.lastWeekMin ? '▲' : '▼'} {Math.abs(stats.weekMin - stats.lastWeekMin)}m vs. semana pasada</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rk-card relative overflow-hidden" style={{ padding: '18px 20px', borderColor: 'rgba(225,6,0,0.28)' }}>
                    <div className="rk-glow-red" style={{ width: 180, height: 180, top: -80, right: -50, borderRadius: '50%' }} />
                    <div className="relative flex items-center gap-4 flex-wrap sm:flex-nowrap">
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-red-600/12 border border-red-500/30 text-red-400 anim-pulse-glow"><i className="ri-fire-line text-2xl"></i></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">Aún no has registrado tu entreno de hoy</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{stats.streak > 0 ? `Tu racha de ${stats.streak} ${stats.streak === 1 ? 'día' : 'días'} está en juego. No la rompas.` : 'Enciende tu racha registrando la sesión de hoy.'}</p>
                      </div>
                      <button onClick={() => setSection('diario')} className="rk-btn rk-btn-primary flex-shrink-0 w-full sm:w-auto" style={{ fontSize: '0.8rem', padding: '0.6rem 1.2rem' }}>REGISTRAR HOY</button>
                    </div>
                  </div>
                )}
              </Reveal>

              <Reveal>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <span className="rk-index">TU ESPACIO</span>
                    <span style={{ flex: '0 0 38px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
                    <span className="rk-eyebrow">Mi Esquina</span>
                  </div>
                  <h1 className="rk-h1" style={{ margin: 0, color: '#fff' }}>
                    BIENVENIDO A TU <span className="rk-red-glow">ESQUINA</span>,<br />{firstName.toUpperCase()}
                  </h1>
                  <p className="text-zinc-400 text-sm mt-2">{isHobby ? 'Tu espacio de entrenamiento. Sin competir, pero con la misma disciplina.' : 'Todo lo que necesitas para entrenar mejor, en un solo sitio.'}</p>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { v: String(stats.total), l: 'Sesiones totales', c: '#ffffff' },
                    { v: String(stats.week), l: 'Esta semana', c: '#E10600' },
                    { v: stats.weekMin >= 60 ? `${Math.floor(stats.weekMin / 60)}h ${stats.weekMin % 60}m` : `${stats.weekMin}m`, l: 'Tiempo semanal', c: '#4ade80' },
                  ].map((s) => (
                    <div key={s.l} className="rk-card" style={{ padding: '22px 14px', textAlign: 'center' }}>
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,5vw,40px)', lineHeight: 1, color: s.c, margin: 0 }}>{s.v}</p>
                      <p className="rk-body" style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 8 }}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={140}>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { s: 'diario' as Section, icon: 'ri-calendar-check-line', title: 'Registra tu entreno de hoy', desc: 'Suma a tu racha y controla tu carga semanal', cta: 'Ir al diario' },
                    { s: 'timer' as Section, icon: 'ri-timer-flash-line', title: 'Temporizador de asaltos', desc: 'Entrena con el ritmo real del combate, con campana', cta: 'Abrir timer' },
                    { s: 'rutina' as Section, icon: 'ri-calendar-2-line', title: 'Planifica tu semana', desc: 'Organiza tus entrenos y ve tachando lo cumplido', cta: 'Ver mi semana' },
                    { s: 'material' as Section, icon: 'ri-boxing-line', title: 'Guía de material', desc: 'Guantes, vendas, protecciones: qué comprar y por qué', cta: 'Ver guía' },
                    { s: 'nutricion' as Section, icon: 'ri-restaurant-line', title: 'Nutrición del peleador', desc: 'Lo esencial para rendir: comida, hidratación y descanso', cta: 'Ver consejos' },
                    { s: 'coach' as Section, icon: 'ri-sparkling-2-line', title: 'Coach IA', desc: 'Tu entrenador personal inteligente está en camino', cta: 'Saber más' },
                  ].map((c) => (
                    <button key={c.title} onClick={() => setSection(c.s)} className="rk-card text-left group" style={{ padding: 20, cursor: 'pointer' }}>
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400 mb-3"><i className={`${c.icon} text-lg`}></i></div>
                      <p className="text-sm font-bold text-white">{c.title}</p>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{c.desc}</p>
                      <p className="text-xs font-bold text-red-400 mt-3 flex items-center gap-1 group-hover:gap-2 transition-all">{c.cta} <i className="ri-arrow-right-line"></i></p>
                    </button>
                  ))}
                </div>
              </Reveal>
            </div>
          )}

          {section === 'diario' && <FighterTraining profile={profile} showToast={showToast} />}

          {section === 'mensajes' && <div className="max-w-5xl"><MessagesPanel currentUserId={profile.id} /></div>}

          {section === 'rutina' && <WeeklyPlanner profile={profile} showToast={showToast} />}

          {section === 'timer' && <RoundTimer />}

          {section === 'coach' && (
            <div className="space-y-5 max-w-3xl">
              <Reveal>
                <div>
                  <p className="rk-eyebrow">TU ESQUINA INTELIGENTE</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
                    COACH DE <span className="rk-red-glow">ENTRENAMIENTO</span>
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Planifica sesiones y rutinas con una IA que conoce tu disciplina, nivel y objetivo. Pídele un plan, ajústalo en conversación y llévalo a tu diario.</p>
                </div>
              </Reveal>
              <Reveal delay={80}>
                <SectionCoach
                  section="training"
                  profile={profile}
                  showToast={showToast}
                  accent="red"
                  title="Coach de entrenamiento"
                  intro="Cuéntame tu objetivo y te armo un plan. Por ejemplo, una semana de entreno o la preparación de una pelea."
                  suggestions={['Plan de esta semana', 'Quiero ganar fuerza este mes', 'Prepárame para una pelea en 6 semanas', 'Rutina para mejorar el cardio']}
                />
              </Reveal>
            </div>
          )}

          {section === 'material' && (
            <div className="space-y-8 max-w-4xl">
              {/* Herramienta real: inventario de material */}
              <GearChecklist profile={profile} showToast={showToast} />

              <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />

              {/* IA de material: recomendaciones concretas por disciplina/nivel */}
              <Reveal>
                <div className="mb-4">
                  <p className="rk-eyebrow">RECOMENDACIONES A MEDIDA</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.1rem)', margin: '4px 0 0', color: '#fff' }}>ASESOR DE <span className="rk-red-glow">MATERIAL</span></h2>
                  <p className="text-zinc-400 text-sm mt-1.5">Dile qué buscas y te recomienda marcas y características según tu disciplina y nivel.</p>
                </div>
                <SectionCoach
                  section="gear"
                  profile={profile}
                  showToast={showToast}
                  accent="red"
                  title="Asesor de material"
                  intro="Dime qué necesitas comprar y para qué, y te oriento con características y marcas según tu nivel."
                  suggestions={['¿Qué guantes me compro?', 'Equipo para empezar de cero', 'Espinilleras para Muay Thai', 'Bucal: cuál merece la pena']}
                />
              </Reveal>

              <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />

              {/* Guía de compra */}
              <Reveal>
                <div>
                  <p className="rk-eyebrow">SIN HUMO</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.1rem)', margin: '4px 0 0', color: '#fff' }}>GUÍA DE <span className="rk-red-glow">COMPRA</span></h2>
                  <p className="text-zinc-400 text-sm mt-1.5">Qué necesitas de verdad para entrenar deportes de contacto.</p>
                </div>
              </Reveal>
              <div className="grid sm:grid-cols-2 gap-4">
                {GEAR.map((g, i) => (
                  <Reveal key={g.title} delay={Math.min(i, 5) * 60}>
                    <div className="rk-card" style={{ padding: 20 }}>
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
                  </Reveal>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600">Consejo general orientativo. Consulta siempre con tu entrenador para tu caso concreto.</p>
            </div>
          )}

          {section === 'nutricion' && (
            <div className="space-y-8 max-w-4xl">
              {/* Herramienta real: peso e hidratación */}
              <NutritionTracker profile={profile} showToast={showToast} />

              <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />

              {/* Diario de comidas + IA de nutrición */}
              <Reveal>
                <div className="mb-4">
                  <p className="rk-eyebrow">TU DIETA, A DIARIO</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.1rem)', margin: '4px 0 0', color: '#fff' }}>COACH DE <span className="rk-red-glow">NUTRICIÓN</span></h2>
                  <p className="text-zinc-400 text-sm mt-1.5">Apunta lo que comes y pide a la IA que te planifique o ajuste la dieta según tu peso y objetivo.</p>
                </div>
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  <MealLog profile={profile} showToast={showToast} />
                  <SectionCoach
                    section="nutrition"
                    profile={profile}
                    showToast={showToast}
                    accent="sky"
                    title="Coach de nutrición"
                    intro="Cuéntame tu objetivo o pídeme un plan de comidas. Puedo ajustarlo si me dices qué quitar o reforzar."
                    suggestions={['Planifícame el día de hoy', 'Quítame los lácteos', 'Necesito más proteína esta semana', 'Menú para bajar al peso objetivo']}
                  />
                </div>
              </Reveal>

              <div className="rk-rule" style={{ width: '100%', opacity: 0.5 }} />

              {/* Guía informativa */}
              <Reveal>
                <div>
                  <p className="rk-eyebrow">SIN HUMO</p>
                  <h2 className="rk-h2" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.1rem)', margin: '4px 0 0', color: '#fff' }}>GUÍA DE <span className="rk-red-glow">NUTRICIÓN</span></h2>
                  <p className="text-zinc-400 text-sm mt-1.5">Los básicos que marcan la diferencia. Sin milagros.</p>
                </div>
              </Reveal>
              <div className="grid sm:grid-cols-2 gap-4">
                {NUTRITION.map((n, i) => (
                  <Reveal key={n.title} delay={Math.min(i, 5) * 60}>
                    <div className="rk-card" style={{ padding: 20 }}>
                      <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500/10 border border-green-500/25 text-green-400"><i className={`${n.icon} text-lg`}></i></div>
                        <h3 className="text-base font-bold text-white">{n.title}</h3>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{n.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
              <div className="rk-card flex items-start gap-3" style={{ padding: 16 }}>
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
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import Reveal from '@/components/base/Reveal';

type RoleId = 'fighter' | 'org' | 'brand' | 'public';

const ROLES: { id: RoleId; label: string; icon: string; tagline: string; accent: string }[] = [
  { id: 'fighter', label: 'Soy peleador', icon: 'ri-boxing-line', tagline: 'Entreno, compito o ambas', accent: '#E10600' },
  { id: 'org', label: 'Promotora o gimnasio', icon: 'ri-trophy-line', tagline: 'Organizo eventos y busco talento', accent: '#E10600' },
  { id: 'brand', label: 'Soy una marca', icon: 'ri-store-2-line', tagline: 'Patrocino y vendo producto', accent: '#C9A84C' },
  { id: 'public', label: 'Solo quiero ver', icon: 'ri-user-heart-line', tagline: 'Aficionado a los deportes de combate', accent: '#C9A84C' },
];

interface Block { icon: string; title: string; desc: string }

const CONTENT: Record<RoleId, { intro: string; groups: { name?: string; blocks: Block[] }[]; cta: { label: string; to: string }; note?: string }> = {
  fighter: {
    intro: 'RANKD es tu esquina digital: el sitio donde entrenas con método y, si compites, donde te encuentran. Funciona igual si peleas en veladas o si entrenas por afición — tú eliges cuánto quieres exponerte.',
    groups: [
      {
        name: 'Si entrenas por afición',
        blocks: [
          { icon: 'ri-boxing-line', title: 'Mi Esquina, tu herramienta diaria', desc: 'Diario de entrenos con gráficos de volumen, racha de días, planificador semanal y temporizador de asaltos con campana. Todo lo que registras se queda y se convierte en tu progreso.' },
          { icon: 'ri-restaurant-line', title: 'Nutrición y peso de verdad', desc: 'Registra hidratación y peso, ponte un objetivo y ve la evolución en un gráfico. Apunta tus comidas día a día para construir un histórico real, no consejos sueltos.' },
          { icon: 'ri-shopping-bag-line', title: 'Material e inventario', desc: 'Marca el equipo que ya tienes, controla su estado y sabe cuándo toca reemplazar guantes, vendas o bucal. Con guía de compra sin humo.' },
        ],
      },
      {
        name: 'Si compites',
        blocks: [
          { icon: 'ri-profile-line', title: 'Tu ficha pública', desc: 'Récord, categoría, vídeos, logros y redes en un perfil que promotoras y marcas pueden encontrar en el directorio. Tú decides cuándo publicarlo.' },
          { icon: 'ri-megaphone-line', title: 'Oportunidades reales', desc: 'Combates, patrocinios y contratos publicados por promotoras y marcas. Te postulas desde la plataforma y hablas por mensajes directos.' },
          { icon: 'ri-shield-check-line', title: 'Verificación', desc: 'Solicita verificar tu récord para ganar credibilidad frente a quien te está evaluando.' },
        ],
      },
    ],
    cta: { label: 'CREAR MI ESQUINA GRATIS', to: '/auth' },
    note: 'Gratis, sin comisiones. Si entrenas por afición no verás nada del marketplace: tu espacio es Mi Esquina.',
  },
  org: {
    intro: 'Si organizas veladas o diriges un gimnasio, RANKD te da las dos cosas que más cuestan: llenar el cartel y llenar el aforo. Sin intermediarios.',
    groups: [
      {
        blocks: [
          { icon: 'ri-calendar-event-line', title: 'Publica tus eventos', desc: 'Crea la velada con su cartel, fecha y ubicación. Aparece en la cartelera pública de RANKD, donde el público la descubre.' },
          { icon: 'ri-ticket-2-line', title: 'Vende entradas', desc: 'Define tipos de entrada (General, VIP, Ringside), precio y aforo. El público reserva desde la ficha del evento y tú ves las reservas en tu panel, con el aforo actualizándose solo.' },
          { icon: 'ri-search-eye-line', title: 'Busca peleadores', desc: 'Filtra el directorio por disciplina, categoría de peso, nivel, país y disponibilidad. Ves el récord de un vistazo, sin entrar perfil por perfil.' },
          { icon: 'ri-user-received-line', title: 'Recibe postulaciones', desc: 'Publica oportunidades de combate y recibe candidatos ordenados en tu panel. Hablas con ellos por mensajes dentro de la plataforma.' },
        ],
      },
    ],
    cta: { label: 'CREAR CUENTA DE PROMOTORA', to: '/auth' },
    note: 'El cobro con tarjeta de las entradas está en marcha; hoy las reservas te llegan con los datos del comprador para que cierres el pago.',
  },
  brand: {
    intro: 'Una marca en RANKD hace dos cosas muy distintas, y las tienes separadas para que no se mezclen: patrocinar talento y vender producto.',
    groups: [
      {
        name: 'Función 1 · Patrocinar y darte a conocer',
        blocks: [
          { icon: 'ri-user-star-line', title: 'Encuentra a quién patrocinar', desc: 'Busca peleadores por disciplina, nivel y presencia digital. Ves su récord y sus redes antes de contactar.' },
          { icon: 'ri-megaphone-line', title: 'Publica patrocinios', desc: 'Lanza oportunidades de patrocinio y recibe candidaturas de peleadores interesados.' },
          { icon: 'ri-eye-line', title: 'Visibilidad ante el sector', desc: 'Apareces ante promotoras y gimnasios que organizan eventos y buscan patrocinadores.' },
        ],
      },
      {
        name: 'Función 2 · Vender producto',
        blocks: [
          { icon: 'ri-store-3-line', title: 'Tu escaparate público', desc: 'Publica tu catálogo de equipamiento, nutrición o servicios. Aparece en el directorio de marcas, donde peleadores y público general te encuentran.' },
          { icon: 'ri-price-tag-3-line', title: 'Producto y servicios', desc: 'Da igual si vendes guantes, suplementos o servicios de fisioterapia: cada tipo tiene su sitio y su filtro.' },
        ],
      },
    ],
    cta: { label: 'REGISTRAR MI MARCA', to: '/auth' },
  },
  public: {
    intro: 'No hace falta que pelees para usar RANKD. Si te gustan los deportes de combate, aquí encuentras qué ver y dónde equiparte.',
    groups: [
      {
        blocks: [
          { icon: 'ri-calendar-event-line', title: 'Descubre eventos cerca', desc: 'La cartelera pública con las próximas veladas de boxeo, MMA, kickboxing y muay thai, con fecha, ubicación y quién las organiza.' },
          { icon: 'ri-ticket-2-line', title: 'Consigue tus entradas', desc: 'Reserva tu entrada desde la ficha del evento, eligiendo tipo y cantidad. Sin pasar por reventa.' },
          { icon: 'ri-shopping-bag-line', title: 'Compra material', desc: 'Explora el directorio de marcas por categoría y disciplina: guantes, protecciones, ropa, nutrición.' },
          { icon: 'ri-search-line', title: 'Sigue a los peleadores', desc: 'Consulta el directorio, mira récords, vídeos y redes de los que compiten.' },
        ],
      },
    ],
    cta: { label: 'VER PRÓXIMOS EVENTOS', to: '/eventos' },
  },
};

const PILLARS = [
  { icon: 'ri-links-line', title: 'Conecta el sector', desc: 'Peleadores, promotoras, gimnasios y marcas en un mismo sitio, hablando directamente entre ellos.' },
  { icon: 'ri-tools-line', title: 'Herramientas reales', desc: 'No es solo un escaparate: Mi Esquina es una herramienta de entrenamiento de uso diario.' },
  { icon: 'ri-money-euro-circle-line', title: 'Sin intermediarios', desc: 'Crear tu perfil es gratis y no nos llevamos comisión por los acuerdos que cierres.' },
];

export default function ComoFuncionaPage() {
  useSEO({
    title: 'Cómo funciona RANKD | La plataforma de deportes de combate',
    description: 'Descubre cómo funciona RANKD según quién eres: peleador, promotora, gimnasio, marca o aficionado. Mi Esquina, eventos, entradas, patrocinios y directorio.',
  });

  const navigate = useNavigate();
  // Permite enlazar directamente a un camino: /como-funciona?role=org
  const [params] = useSearchParams();
  const roleParam = params.get('role');
  const initialRole: RoleId = (['fighter', 'org', 'brand', 'public'] as const).includes(roleParam as RoleId)
    ? (roleParam as RoleId)
    : 'fighter';
  const [role, setRole] = useState<RoleId>(initialRole);
  const active = CONTENT[role];
  const activeRole = ROLES.find((r) => r.id === role)!;

  return (
    <div className="min-h-screen bg-[#070707]">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden rk-grid-bg" style={{ background: '#050505', paddingTop: 'calc(60px + env(safe-area-inset-top,0px))' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 72% 40%, rgba(225,6,0,0.16) 0%, transparent 56%)' }} />
        <div className="rk-topline" />
        <span aria-hidden="true" className="pointer-events-none select-none absolute -right-6 bottom-0 hidden md:block" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(110px,15vw,230px)', lineHeight: 0.7, color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.04)' }}>RANKD</span>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-14 md:py-20">
          <div className="flex items-center gap-3 mb-4">
            <span className="rk-index">EMPIEZA AQUÍ</span>
            <span style={{ flex: '0 0 34px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
            <span className="rk-eyebrow">Cómo funciona</span>
          </div>
          <h1 className="rk-h1" style={{ color: '#fff', margin: 0 }}>
            TODO EL COMBATE,<br /><span className="rk-red-glow">EN UN SITIO</span>
          </h1>
          <div className="rk-rule" style={{ width: 88, margin: '20px 0' }} />
          <p className="rk-body max-w-2xl" style={{ margin: 0 }}>
            RANKD es la plataforma donde el mundo de los deportes de combate se organiza: los peleadores entrenan y se dan a conocer, las promotoras montan sus veladas y venden entradas, y las marcas patrocinan y venden su producto. Elige abajo quién eres y te contamos tu camino.
          </p>
        </div>
      </section>

      {/* ── PILARES ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-10">
        <div className="grid sm:grid-cols-3 gap-4">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <div className="rk-card h-full" style={{ padding: '20px 22px' }}>
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400 mb-3">
                  <i className={`${p.icon} text-lg`}></i>
                </div>
                <h3 className="text-sm font-bold text-white">{p.title}</h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── SELECTOR DE ROL ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pb-16">
        <Reveal>
          <div className="mb-5">
            <p className="rk-eyebrow">TU CAMINO</p>
            <h2 className="rk-h2" style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>¿QUIÉN ERES?</h2>
            <p className="text-zinc-400 text-sm mt-1.5">Elige tu perfil y verás exactamente qué puedes hacer aquí.</p>
          </div>
        </Reveal>

        {/* Pestañas de rol */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
          {ROLES.map((r) => {
            const isActive = r.id === role;
            return (
              <button key={r.id} onClick={() => setRole(r.id)}
                className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${isActive ? 'bg-white/[0.06] border-white/25' : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20'}`}
                style={isActive ? { borderColor: `${r.accent}66`, background: `${r.accent}12` } : undefined}>
                <i className={`${r.icon} text-xl`} style={{ color: isActive ? r.accent : 'rgba(255,255,255,0.45)' }}></i>
                <p className="text-sm font-bold text-white mt-2 leading-tight">{r.label}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{r.tagline}</p>
              </button>
            );
          })}
        </div>

        {/* Contenido del rol */}
        <div key={role} className="anim-fade-up">
          <div className="rk-card" style={{ padding: 'clamp(20px,4vw,30px)' }}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border" style={{ background: `${activeRole.accent}18`, borderColor: `${activeRole.accent}45`, color: activeRole.accent }}>
                <i className={`${activeRole.icon} text-xl`}></i>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed flex-1">{active.intro}</p>
            </div>

            {active.groups.map((g) => (
              <div key={g.name || 'main'} className="mb-5 last:mb-0">
                {g.name && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: activeRole.accent }}>{g.name}</span>
                    <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  {g.blocks.map((b) => (
                    <div key={b.title} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <i className={`${b.icon} text-base`} style={{ color: activeRole.accent }}></i>
                        <h4 className="text-sm font-bold text-white">{b.title}</h4>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{b.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-6 pt-5 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center gap-3">
              <button onClick={() => navigate(active.cta.to)} className="rk-btn rk-btn-primary w-full sm:w-auto" style={{ fontSize: '0.9rem' }}>
                {active.cta.label}
              </button>
              {active.note && <p className="text-[11px] text-zinc-500 leading-relaxed flex-1">{active.note}</p>}
            </div>
          </div>
        </div>

        {/* Enlaces rápidos */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {[
            { icon: 'ri-search-line', label: 'Peleadores', to: '/fighters' },
            { icon: 'ri-calendar-event-line', label: 'Próximos eventos', to: '/eventos' },
            { icon: 'ri-trophy-line', label: 'Promotoras y gimnasios', to: '/promotoras' },
            { icon: 'ri-store-2-line', label: 'Marcas y tienda', to: '/brands' },
          ].map((l) => (
            <button key={l.to} onClick={() => navigate(l.to)} className="rk-card p-4 flex items-center gap-3 cursor-pointer text-left group">
              <i className={`${l.icon} text-lg text-zinc-400 group-hover:text-red-400 transition-colors`}></i>
              <span className="text-sm text-white flex-1">{l.label}</span>
              <i className="ri-arrow-right-line text-zinc-600 group-hover:text-red-400 transition-colors"></i>
            </button>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}

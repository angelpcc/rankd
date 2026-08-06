import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSEO } from '@/hooks/useSEO';
import Navbar from '@/pages/home/components/Navbar';
import Footer from '@/pages/home/components/Footer';
import Reveal from '@/components/base/Reveal';

type RoleId = 'fighter' | 'org' | 'brand' | 'public';

const ROLES: { id: RoleId; labelKey: string; icon: string; tagKey: string; accent: string }[] = [
  { id: 'fighter', labelKey: 'cf_role_fighter_label', icon: 'ri-boxing-line', tagKey: 'cf_role_fighter_tag', accent: '#E10600' },
  { id: 'org', labelKey: 'cf_role_org_label', icon: 'ri-trophy-line', tagKey: 'cf_role_org_tag', accent: '#E10600' },
  { id: 'brand', labelKey: 'cf_role_brand_label', icon: 'ri-store-2-line', tagKey: 'cf_role_brand_tag', accent: '#C9A84C' },
  { id: 'public', labelKey: 'cf_role_public_label', icon: 'ri-user-heart-line', tagKey: 'cf_role_public_tag', accent: '#C9A84C' },
];

interface Block { icon: string; titleKey: string; descKey: string }

const CONTENT: Record<RoleId, { introKey: string; groups: { nameKey?: string; blocks: Block[] }[]; cta: { labelKey: string; to: string }; noteKey?: string }> = {
  fighter: {
    introKey: 'cf_f_intro',
    groups: [
      {
        nameKey: 'cf_f_g1_name',
        blocks: [
          { icon: 'ri-boxing-line', titleKey: 'cf_f_b1_t', descKey: 'cf_f_b1_d' },
          { icon: 'ri-restaurant-line', titleKey: 'cf_f_b2_t', descKey: 'cf_f_b2_d' },
          { icon: 'ri-shopping-bag-line', titleKey: 'cf_f_b3_t', descKey: 'cf_f_b3_d' },
        ],
      },
      {
        nameKey: 'cf_f_g2_name',
        blocks: [
          { icon: 'ri-profile-line', titleKey: 'cf_f_b4_t', descKey: 'cf_f_b4_d' },
          { icon: 'ri-megaphone-line', titleKey: 'cf_f_b5_t', descKey: 'cf_f_b5_d' },
          { icon: 'ri-shield-check-line', titleKey: 'cf_f_b6_t', descKey: 'cf_f_b6_d' },
        ],
      },
    ],
    cta: { labelKey: 'cf_f_cta', to: '/auth' },
    noteKey: 'cf_f_note',
  },
  org: {
    introKey: 'cf_o_intro',
    groups: [
      {
        blocks: [
          { icon: 'ri-calendar-event-line', titleKey: 'cf_o_b1_t', descKey: 'cf_o_b1_d' },
          { icon: 'ri-ticket-2-line', titleKey: 'cf_o_b2_t', descKey: 'cf_o_b2_d' },
          { icon: 'ri-search-eye-line', titleKey: 'cf_o_b3_t', descKey: 'cf_o_b3_d' },
          { icon: 'ri-user-received-line', titleKey: 'cf_o_b4_t', descKey: 'cf_o_b4_d' },
        ],
      },
    ],
    cta: { labelKey: 'cf_o_cta', to: '/auth' },
    noteKey: 'cf_o_note',
  },
  brand: {
    introKey: 'cf_b_intro',
    groups: [
      {
        nameKey: 'cf_b_g1_name',
        blocks: [
          { icon: 'ri-user-star-line', titleKey: 'cf_b_b1_t', descKey: 'cf_b_b1_d' },
          { icon: 'ri-megaphone-line', titleKey: 'cf_b_b2_t', descKey: 'cf_b_b2_d' },
          { icon: 'ri-eye-line', titleKey: 'cf_b_b3_t', descKey: 'cf_b_b3_d' },
        ],
      },
      {
        nameKey: 'cf_b_g2_name',
        blocks: [
          { icon: 'ri-store-3-line', titleKey: 'cf_b_b4_t', descKey: 'cf_b_b4_d' },
          { icon: 'ri-price-tag-3-line', titleKey: 'cf_b_b5_t', descKey: 'cf_b_b5_d' },
        ],
      },
    ],
    cta: { labelKey: 'cf_b_cta', to: '/auth' },
  },
  public: {
    introKey: 'cf_p_intro',
    groups: [
      {
        blocks: [
          { icon: 'ri-calendar-event-line', titleKey: 'cf_p_b1_t', descKey: 'cf_p_b1_d' },
          { icon: 'ri-ticket-2-line', titleKey: 'cf_p_b2_t', descKey: 'cf_p_b2_d' },
          { icon: 'ri-shopping-bag-line', titleKey: 'cf_p_b3_t', descKey: 'cf_p_b3_d' },
          { icon: 'ri-search-line', titleKey: 'cf_p_b4_t', descKey: 'cf_p_b4_d' },
        ],
      },
    ],
    cta: { labelKey: 'cf_p_cta', to: '/eventos' },
  },
};

const PILLARS = [
  { icon: 'ri-links-line', titleKey: 'cf_pillar1_t', descKey: 'cf_pillar1_d' },
  { icon: 'ri-tools-line', titleKey: 'cf_pillar2_t', descKey: 'cf_pillar2_d' },
  { icon: 'ri-money-euro-circle-line', titleKey: 'cf_pillar3_t', descKey: 'cf_pillar3_d' },
];

export default function ComoFuncionaPage() {
  const { t } = useTranslation();
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
            <span className="rk-index">{t('cf_index')}</span>
            <span style={{ flex: '0 0 34px', height: 1, background: 'rgba(255,255,255,0.16)' }} />
            <span className="rk-eyebrow">{t('cf_eyebrow')}</span>
          </div>
          <h1 className="rk-h1" style={{ color: '#fff', margin: 0 }}>
            {t('cf_title')}<br /><span className="rk-red-glow">{t('cf_title_2')}</span>
          </h1>
          <div className="rk-rule" style={{ width: 88, margin: '20px 0' }} />
          <p className="rk-body max-w-2xl" style={{ margin: 0 }}>
            {t('cf_hero_sub')}
          </p>
        </div>
      </section>

      {/* ── PILARES ── (compactos en móvil: 3 en fila, sin descripción) ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-7 sm:py-10">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {PILLARS.map((p, i) => (
            <Reveal key={p.titleKey} delay={i * 80}>
              <div className="rk-card h-full flex flex-col items-center text-center sm:items-start sm:text-left p-3 sm:!p-[22px]">
                <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-red-600/12 border border-red-500/25 text-red-400 mb-2 sm:mb-3">
                  <i className={`${p.icon} text-base sm:text-lg`}></i>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white leading-tight">{t(p.titleKey)}</h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed hidden sm:block">{t(p.descKey)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── SELECTOR DE ROL ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 pb-16">
        <Reveal>
          <div className="mb-5">
            <p className="rk-eyebrow">{t('cf_path')}</p>
            <h2 className="rk-h2" style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>{t('cf_who')}</h2>
            <p className="text-zinc-400 text-sm mt-1.5">{t('cf_who_sub')}</p>
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
                <p className="text-sm font-bold text-white mt-2 leading-tight">{t(r.labelKey)}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{t(r.tagKey)}</p>
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
              <p className="text-sm text-zinc-300 leading-relaxed flex-1">{t(active.introKey)}</p>
            </div>

            {active.groups.map((g, gi) => (
              <div key={g.nameKey || `main-${gi}`} className="mb-5 last:mb-0">
                {g.nameKey && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: activeRole.accent }}>{t(g.nameKey)}</span>
                    <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
                  {g.blocks.map((b) => (
                    <div key={b.titleKey} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4">
                      <div className="flex items-center gap-2.5 mb-1 sm:mb-1.5">
                        <i className={`${b.icon} text-base flex-shrink-0`} style={{ color: activeRole.accent }}></i>
                        <h4 className="text-sm font-bold text-white leading-tight">{t(b.titleKey)}</h4>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 sm:line-clamp-none pl-[26px] sm:pl-0">{t(b.descKey)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-6 pt-5 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center gap-3">
              <button onClick={() => navigate(active.cta.to)} className="rk-btn rk-btn-primary w-full sm:w-auto" style={{ fontSize: '0.9rem' }}>
                {t(active.cta.labelKey)}
              </button>
              {active.noteKey && <p className="text-[11px] text-zinc-500 leading-relaxed flex-1">{t(active.noteKey)}</p>}
            </div>
          </div>
        </div>

        {/* Enlaces rápidos */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {[
            { icon: 'ri-search-line', labelKey: 'cf_link_fighters', to: '/fighters' },
            { icon: 'ri-calendar-event-line', labelKey: 'cf_link_events', to: '/eventos' },
            { icon: 'ri-trophy-line', labelKey: 'cf_link_promoters', to: '/promotoras' },
            { icon: 'ri-store-2-line', labelKey: 'cf_link_brands', to: '/brands' },
          ].map((l) => (
            <button key={l.to} onClick={() => navigate(l.to)} className="rk-card p-4 flex items-center gap-3 cursor-pointer text-left group">
              <i className={`${l.icon} text-lg text-zinc-400 group-hover:text-red-400 transition-colors`}></i>
              <span className="text-sm text-white flex-1">{t(l.labelKey)}</span>
              <i className="ri-arrow-right-line text-zinc-600 group-hover:text-red-400 transition-colors"></i>
            </button>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}

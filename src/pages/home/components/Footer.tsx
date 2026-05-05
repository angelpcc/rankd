import { useTranslation } from 'react-i18next';

function RankdLogo() {
  return (
    <div className="flex items-center gap-0 select-none">
      <span className="font-unbounded font-black leading-none" style={{ fontSize: '22px', color: '#FFFFFF', letterSpacing: '-0.05em' }}>RAN</span>
      <span className="font-unbounded font-black leading-none" style={{ fontSize: '22px', color: '#E10600', letterSpacing: '-0.05em' }}>KD</span>
    </div>
  );
}

export default function Footer() {
  const { t } = useTranslation();

  const handleAnchorNav = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { labelKey: 'nav_home', href: '#home', isAnchor: true },
    { labelKey: 'nav_how_it_works', href: '#how-it-works', isAnchor: true },
    { labelKey: 'footer_fighters', href: '#fighters', isAnchor: true },
    { labelKey: 'footer_opportunities', href: '#opportunities', isAnchor: true },
    { labelKey: 'nav_brands', href: '/brands', isAnchor: false },
    { labelKey: 'nav_contact', href: '#contact', isAnchor: true },
  ];

  const socials = [
    { icon: 'ri-instagram-line', label: 'Instagram' },
    { icon: 'ri-twitter-x-line', label: 'Twitter' },
    { icon: 'ri-youtube-line', label: 'YouTube' },
    { icon: 'ri-tiktok-line', label: 'TikTok' },
  ];

  return (
    <footer className="bg-[#080808] text-white relative overflow-hidden"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Top red accent */}
      <div className="h-[2px] bg-gradient-to-r from-[#E10600] via-[#ff2020] to-transparent" />

      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 md:gap-16 mb-14">
          {/* Col 1 — Marca */}
          <div>
            <RankdLogo />
            <p className="text-white/25 text-sm leading-relaxed mb-7 mt-5 font-inter max-w-xs">
              {t('footer_description')}
            </p>
            <div className="flex gap-2">
              {socials.map((s) => (
                <a key={s.label} href="#" rel="nofollow"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-white/20 hover:text-white hover:bg-[#E10600] transition-all cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <i className={`${s.icon} text-sm`} />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 — Navegación */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/15 mb-6 font-inter">{t('footer_navigation')}</div>
            <ul className="space-y-3.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => { if (link.isAnchor) { e.preventDefault(); handleAnchorNav(link.href); } }}
                    className="text-white/25 hover:text-white text-sm transition-colors cursor-pointer font-inter"
                  >
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Contacto */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/15 mb-6 font-inter">{t('footer_contact')}</div>
            <div className="space-y-4 text-sm text-white/25 font-inter">
              <a href="mailto:hola@rankd.com" className="block hover:text-[#E10600] transition-colors">hola@rankd.com</a>
              <a href="tel:638933153" className="block hover:text-[#E10600] transition-colors">638 933 153</a>
              <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-xs font-bold uppercase tracking-widest text-white/15 mb-2 font-inter">{t('footer_headquarters')}</div>
                <div>Madrid, España</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-white/15 font-inter"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div>{t('footer_rights')}</div>
          <div className="flex gap-5">
            <a href="#" rel="nofollow" className="hover:text-white transition-colors cursor-pointer">{t('footer_privacy')}</a>
            <a href="#" rel="nofollow" className="hover:text-white transition-colors cursor-pointer">{t('footer_terms')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

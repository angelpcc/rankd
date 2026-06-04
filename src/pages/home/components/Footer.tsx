import { useTranslation } from 'react-i18next';

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

  return (
    <footer style={{ background: '#030303', borderTop: '1px solid rgba(255,255,255,0.04)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ height: 2, background: 'linear-gradient(to right, #C9A84C, rgba(201,168,76,0.3), transparent)' }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '52px 20px 36px' }}>
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
          {/* Col 1 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 18 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: '#ffffff', letterSpacing: 5, lineHeight: 1 }}>RAN</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: '#E10600', letterSpacing: 5, lineHeight: 1 }}>KD</span>
              <span style={{ width: 7, height: 7, background: '#C9A84C', borderRadius: '50%', marginLeft: 4, marginTop: 2 }} />
            </div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, marginBottom: 24, maxWidth: 280 }}>{t('footer_description')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['ri-instagram-line', 'ri-twitter-x-line', 'ri-youtube-line', 'ri-tiktok-line'].map((icon) => (
                <a key={icon} href="#" rel="nofollow" style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', textDecoration: 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: 14 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#E10600'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#E10600'; (e.currentTarget as HTMLAnchorElement).style.color = 'white'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                  <i className={icon} />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 */}
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.15)', marginBottom: 20 }}>{t('footer_navigation')}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} onClick={(e) => { if (link.isAnchor) { e.preventDefault(); handleAnchorNav(link.href); } }}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.25)', textDecoration: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.25)'}>
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.15)', marginBottom: 20 }}>{t('footer_contact')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a href="mailto:hola@rankd.com" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.25)', textDecoration: 'none', transition: 'color 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = '#C9A84C'} onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.25)'}>hola@rankd.com</a>
              <a href="tel:638933153" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.25)', textDecoration: 'none', transition: 'color 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = '#C9A84C'} onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.25)'}>638 933 153</a>
              <div style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.1)', marginBottom: 6 }}>{t('footer_headquarters')}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.25)' }}>Madrid, España</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.12)', letterSpacing: 1 }}>{t('footer_rights')}</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[{ key: 'footer_privacy' }, { key: 'footer_terms' }].map((l) => (
              <a key={l.key} href="#" rel="nofollow" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.12)', textDecoration: 'none', letterSpacing: 1, cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'white'} onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.12)'}>
                {t(l.key)}
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:860px){
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
        @media(max-width:520px){
          .footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
      `}</style>
    </footer>
  );
}
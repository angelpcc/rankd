import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

export default function Contact() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [focused, setFocused] = useState<string | null>(null);

  const roles = [t('contact_role_amateur'), t('contact_role_pro'), t('contact_role_promoter'), t('contact_role_manager'), t('contact_role_brand'), t('contact_role_media')];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value;
    if (message.length > 500) return;
    setLoading(true);
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const role = (form.elements.namedItem('role') as HTMLSelectElement).value;
    const discipline = (form.elements.namedItem('discipline') as HTMLInputElement).value;
    const subject = encodeURIComponent('Contacto desde RANKD');
    const body = encodeURIComponent(`Nombre: ${name}\nEmail: ${email}\nRol: ${role}\nDisciplina: ${discipline}\n\nMensaje:\n${message}`);
    window.open(`mailto:hola@rankd.es?subject=${subject}&body=${body}`, '_blank');
    setSubmitted(true);
    setLoading(false);
  };

  const inputStyle = (field: string) => ({
    width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${focused === field ? '#C9A84C' : 'rgba(255,255,255,0.07)'}`,
    borderRadius: 10, padding: '14px 16px', color: 'white', fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
    fontFamily: "'Barlow Condensed', sans-serif", boxSizing: 'border-box' as const,
  });

  return (
    <section id="contact" style={{ padding: '120px 0', background: '#050505', position: 'relative', overflow: 'hidden' }}>
      {/* BG imagen muay thai */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <img src="https://images.unsplash.com/photo-1540496905036-5937c10647cc?w=1920&q=80&fit=crop" alt="Muay Thai" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.08 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #050505 40%, rgba(5,5,5,0.85) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #050505 0%, transparent 20%, transparent 80%, #050505 100%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }} className="contact-grid">
          {/* Left */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 32, height: 2, background: '#C9A84C' }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: '#C9A84C' }}>{t('contact_eyebrow')}</span>
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 6vw, 90px)', lineHeight: 0.92, color: 'white', margin: '0 0 24px' }}>
              {t('contact_headline_1')}<br />
              <span style={{ color: '#E10600' }}>{t('contact_headline_2')}</span><br />
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>{t('contact_headline_3')}</span>
            </h2>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, maxWidth: 420, marginBottom: 48 }}>{t('contact_subtext')}</p>

            {/* Contacto info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
              <a href="tel:638933153" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(201,168,76,0.3)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.06)'}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ri-phone-line" style={{ color: '#C9A84C', fontSize: 16 }} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.72)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 }}>{t('contact_phone_label')}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 600, color: 'white' }}>638 933 153</div>
                </div>
              </a>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ri-map-pin-line" style={{ color: '#C9A84C', fontSize: 16 }} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.72)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 }}>{t('footer_headquarters')}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 600, color: 'white' }}>Madrid, España</div>
                </div>
              </div>
            </div>

            {/* Sociales */}
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.68)', textTransform: 'uppercase', marginBottom: 14 }}>{t('contact_follow')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ icon: 'ri-instagram-line', url: 'https://www.instagram.com/RANKD.__' }].map((s) => (
                  <a key={s.icon} href={s.url} target="_blank" rel="noopener noreferrer" style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.75)', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#E10600'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#E10600'; (e.currentTarget as HTMLAnchorElement).style.color = 'white'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.25)'; }}>
                    <i className={s.icon} style={{ fontSize: 15 }} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div style={{ borderRadius: 20, padding: '40px 44px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <i className="ri-check-line" style={{ color: '#22c55e', fontSize: 26 }} />
                </div>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'white', marginBottom: 12 }}>{t('contact_success_title')}</h3>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.65)' }}>{t('contact_success_desc')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'white', margin: '0 0 6px' }}>{t('contact_form_title')}</h3>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>{t('contact_form_subtitle')}</p>
                </div>
                {[
                  { name: 'name', label: t('contact_label_name'), placeholder: t('contact_placeholder_name'), type: 'text', required: true },
                  { name: 'email', label: t('contact_label_email'), placeholder: t('contact_placeholder_email'), type: 'email', required: true },
                  { name: 'discipline', label: t('contact_label_discipline'), placeholder: t('contact_placeholder_discipline'), type: 'text', required: false },
                ].map((field) => (
                  <div key={field.name}>
                    <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 8 }}>{field.label}</label>
                    <input type={field.type} name={field.name} required={field.required} placeholder={field.placeholder} style={inputStyle(field.name)} onFocus={() => setFocused(field.name)} onBlur={() => setFocused(null)} />
                  </div>
                ))}
                <div>
                  <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 8 }}>{t('contact_label_role')}</label>
                  <select name="role" required style={{ ...inputStyle('role'), colorScheme: 'dark' }} onFocus={() => setFocused('role')} onBlur={() => setFocused(null)}>
                    <option value="" style={{ background: '#111' }}>{t('contact_placeholder_role')}</option>
                    {roles.map((r) => <option key={r} value={r} style={{ background: '#111' }}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 8 }}>
                    {t('contact_label_message')} <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: 10, fontWeight: 400 }}>({charCount}/500)</span>
                  </label>
                  <textarea name="message" required maxLength={500} rows={4} placeholder={t('contact_placeholder_message')} onChange={(e) => setCharCount(e.target.value.length)} style={{ ...inputStyle('message'), resize: 'none' }} onFocus={() => setFocused('message')} onBlur={() => setFocused(null)} />
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(charCount / 500) * 100}%`, background: charCount > 450 ? '#E10600' : '#C9A84C', transition: 'width 0.2s, background 0.2s', borderRadius: 1 }} />
                  </div>
                </div>
                <button type="submit" disabled={loading} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'white', background: '#E10600', border: 'none', borderRadius: 10, padding: '16px', cursor: 'pointer', boxShadow: '0 0 30px rgba(225,6,0,0.2)', transition: 'all 0.2s', opacity: loading ? 0.6 : 1 }}>
                  {loading ? <><i className="ri-loader-4-line" /> {t('btn_sending')}</> : <>{t('btn_send_message')} →</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      <style>{`@media(max-width:900px){.contact-grid{grid-template-columns:1fr!important;gap:48px!important}}`}</style>
    </section>
  );
}
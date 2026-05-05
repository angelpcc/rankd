import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

export default function Contact() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const roles = [
    t('contact_role_amateur'), t('contact_role_pro'), t('contact_role_promoter'),
    t('contact_role_manager'), t('contact_role_brand'), t('contact_role_media'),
  ];

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
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${focusedField === field ? '#E10600' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '12px',
    padding: '14px 16px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  });

  return (
    <section id="contact" className="py-24 md:py-32 relative overflow-hidden bg-[#080808]">
      {/* Background subtle */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]"
          style={{ background: 'radial-gradient(ellipse, rgba(225,6,0,0.06) 0%, transparent 65%)' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* Left — Info */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-6 h-px bg-[#E10600]" />
              <span className="text-[#E10600] text-xs font-semibold tracking-[0.2em] uppercase font-inter">
                {t('contact_eyebrow')}
              </span>
            </div>
            <h2 className="font-unbounded font-black text-white leading-tight mb-6" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
              {t('contact_headline_1')}<br />
              <span style={{ color: '#E10600' }}>{t('contact_headline_2')}</span><br />
              <span className="font-light text-white/20">{t('contact_headline_3')}</span>
            </h2>
            <p className="text-white/35 text-base leading-relaxed mb-12 font-inter max-w-md">
              {t('contact_subtext')}
            </p>

            {/* Info cards */}
            <div className="space-y-3 mb-10">
              <a href="tel:638933153"
                className="flex items-center gap-4 p-4 rounded-xl group cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(225,6,0,0.3)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}>
                <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.2)' }}>
                  <i className="ri-phone-line text-[#E10600]" />
                </div>
                <div>
                  <div className="text-white/25 text-xs font-inter mb-0.5">{t('contact_phone_label')}</div>
                  <div className="text-white font-semibold text-sm font-inter group-hover:text-[#E10600] transition-colors">638 933 153</div>
                </div>
              </a>

              <div className="flex items-center gap-4 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.2)' }}>
                  <i className="ri-map-pin-line text-[#E10600]" />
                </div>
                <div>
                  <div className="text-white/25 text-xs font-inter mb-0.5">Sede</div>
                  <div className="text-white font-semibold text-sm font-inter">Madrid, España</div>
                </div>
              </div>
            </div>

            {/* Redes sociales */}
            <div>
              <div className="text-white/15 text-xs font-bold uppercase tracking-widest mb-4 font-inter">Síguenos</div>
              <div className="flex gap-2">
                {[
                  { icon: 'ri-instagram-line', label: 'Instagram' },
                  { icon: 'ri-twitter-x-line', label: 'Twitter' },
                  { icon: 'ri-youtube-line', label: 'YouTube' },
                  { icon: 'ri-tiktok-line', label: 'TikTok' },
                ].map((s) => (
                  <a key={s.label} href="#" rel="nofollow"
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-white/25 transition-all cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = '#E10600'; el.style.borderColor = '#E10600'; el.style.color = 'white'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.color = 'rgba(255,255,255,0.25)'; }}>
                    <i className={`${s.icon} text-sm`} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Formulario */}
          <div className="rounded-2xl p-7 md:p-9"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 flex items-center justify-center rounded-full mx-auto mb-6"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <i className="ri-check-line text-emerald-400 text-2xl" />
                </div>
                <h3 className="text-white font-unbounded font-bold text-lg mb-3">{t('contact_success_title')}</h3>
                <p className="text-white/35 font-inter text-sm">{t('contact_success_desc')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="mb-2">
                  <h3 className="text-white font-unbounded font-bold text-lg mb-1">{t('contact_form_title')}</h3>
                  <p className="text-white/30 text-sm font-inter">{t('contact_form_subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Nombre */}
                  <div>
                    <label className="text-white/30 text-xs font-semibold uppercase tracking-widest block mb-2 font-inter">{t('contact_label_name')}</label>
                    <input type="text" name="name" required
                      placeholder={t('contact_placeholder_name')}
                      style={inputStyle('name')}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)} />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-white/30 text-xs font-semibold uppercase tracking-widest block mb-2 font-inter">{t('contact_label_email')}</label>
                    <input type="email" name="email" required
                      placeholder={t('contact_placeholder_email')}
                      style={inputStyle('email')}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)} />
                  </div>
                </div>

                {/* Rol */}
                <div>
                  <label className="text-white/30 text-xs font-semibold uppercase tracking-widest block mb-2 font-inter">{t('contact_label_role')}</label>
                  <select name="role" required
                    style={{ ...inputStyle('role'), colorScheme: 'dark' }}
                    onFocus={() => setFocusedField('role')}
                    onBlur={() => setFocusedField(null)}>
                    <option value="" style={{ background: '#111' }}>{t('contact_placeholder_role')}</option>
                    {roles.map((r) => <option key={r} value={r} style={{ background: '#111' }}>{r}</option>)}
                  </select>
                </div>

                {/* Disciplina */}
                <div>
                  <label className="text-white/30 text-xs font-semibold uppercase tracking-widest block mb-2 font-inter">{t('contact_label_discipline')}</label>
                  <input type="text" name="discipline"
                    placeholder={t('contact_placeholder_discipline')}
                    style={inputStyle('discipline')}
                    onFocus={() => setFocusedField('discipline')}
                    onBlur={() => setFocusedField(null)} />
                </div>

                {/* Mensaje */}
                <div>
                  <label className="text-white/30 text-xs font-semibold uppercase tracking-widest block mb-2 font-inter">
                    {t('contact_label_message')}
                    <span className="text-white/15 normal-case font-normal ml-2">({charCount}/500)</span>
                  </label>
                  <textarea name="message" required maxLength={500} rows={4}
                    placeholder={t('contact_placeholder_message')}
                    onChange={(e) => setCharCount(e.target.value.length)}
                    style={{ ...inputStyle('message'), resize: 'none' }}
                    onFocus={() => setFocusedField('message')}
                    onBlur={() => setFocusedField(null)} />
                  {/* Progress bar mensaje */}
                  <div className="mt-1.5 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${(charCount / 500) * 100}%`,
                        background: charCount > 450 ? '#E10600' : charCount > 300 ? '#f59e0b' : '#10b981',
                      }} />
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-3 text-white font-bold py-4 rounded-xl transition-all cursor-pointer disabled:opacity-60 font-inter"
                  style={{ background: '#E10600', boxShadow: '0 0 30px rgba(225,6,0,0.25)' }}
                  onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#b50009'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E10600'; }}>
                  {loading ? (
                    <><i className="ri-loader-4-line animate-spin" /> {t('btn_sending')}</>
                  ) : (
                    <>{t('btn_send_message')} <i className="ri-send-plane-line" /></>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { supabase, Profile, Fighter } from '@/lib/supabase';

interface Props {
  profile: Profile;
  fighter: Fighter | null;
  onClose: () => void;
}

export default function FighterContactModal({ profile, fighter, onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const textarea = form.querySelector('textarea');
    if (textarea && textarea.value.length > 500) return;

    setSubmitting(true);
    setError('');

    const contactName = (form.elements.namedItem('contact_name') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const organization = (form.elements.namedItem('organization') as HTMLInputElement).value;
    const interestType = (form.elements.namedItem('interest_type') as HTMLSelectElement).value;
    const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value;

    try {
      const { error: supaError } = await supabase.from('fighter_inquiries').insert({
        fighter_id: fighter?.id || profile.id,
        fighter_name: profile.full_name || '',
        contact_name: contactName,
        email,
        organization: organization || null,
        interest_type: interestType || null,
        message,
      });

      if (supaError) {
        setError('Error al enviar. Inténtalo de nuevo.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Error al enviar. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-white">Me interesa este peleador</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{profile.full_name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer rounded-lg hover:bg-zinc-800 transition-colors">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Social quick links */}
        {(profile.instagram || profile.tiktok || profile.youtube || profile.twitter) && (
          <div className="px-6 pt-4 pb-0">
            <p className="text-xs text-zinc-500 mb-2">Contacto directo en redes:</p>
            <div className="flex flex-wrap gap-2">
              {profile.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="nofollow noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-pink-600/20 to-orange-600/20 border border-pink-500/30 text-pink-400 hover:text-pink-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-instagram-line"></i> {profile.instagram}
                </a>
              )}
              {profile.tiktok && (
                <a
                  href={`https://tiktok.com/@${profile.tiktok.replace('@', '')}`}
                  target="_blank"
                  rel="nofollow noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-zinc-800 border border-zinc-600 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-tiktok-line"></i> {profile.tiktok}
                </a>
              )}
              {profile.youtube && (
                <a
                  href={profile.youtube}
                  target="_blank"
                  rel="nofollow noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-red-600/20 border border-red-500/30 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-youtube-line"></i> YouTube
                </a>
              )}
              {profile.twitter && (
                <a
                  href={`https://twitter.com/${profile.twitter.replace('@', '')}`}
                  target="_blank"
                  rel="nofollow noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-zinc-800 border border-zinc-600 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-twitter-x-line"></i> {profile.twitter}
                </a>
              )}
            </div>
            <div className="mt-4 border-t border-zinc-800"></div>
          </div>
        )}

        {submitted ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-full bg-green-500/15">
              <i className="ri-check-line text-3xl text-green-400"></i>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">¡Mensaje enviado!</h3>
            <p className="text-sm text-zinc-400 mb-6">Nos pondremos en contacto contigo pronto para conectarte con {profile.full_name}.</p>
            <button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl cursor-pointer whitespace-nowrap transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Tu nombre *</label>
                <input name="contact_name" required className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="Nombre completo" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Email *</label>
                <input name="email" type="email" required className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="tu@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Organización / Empresa</label>
              <input name="organization" className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" placeholder="Nombre de tu promotora, marca..." />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Tipo de interés</label>
              <select name="interest_type" className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer">
                <option value="fight_offer">Oferta de combate</option>
                <option value="sponsorship">Patrocinio</option>
                <option value="management">Representación / Management</option>
                <option value="promotion">Contrato de promoción</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Mensaje *</label>
              <textarea
                name="message"
                required
                rows={4}
                maxLength={500}
                onChange={(e) => setCharCount(e.target.value.length)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                placeholder="Cuéntanos qué tienes en mente..."
              />
              <p className={`text-xs mt-1 text-right ${charCount > 480 ? 'text-red-400' : 'text-zinc-500'}`}>{charCount}/500</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-inter px-4 py-3 rounded-lg flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || charCount > 500}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 text-sm"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Enviando...</>
              ) : (
                <><i className="ri-send-plane-line"></i> Enviar mensaje</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

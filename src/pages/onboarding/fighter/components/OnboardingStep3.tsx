import { FighterOnboardingData } from '../page';

interface Props {
  data: FighterOnboardingData;
  onUpdate: (partial: Partial<FighterOnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const socialFields = [
  {
    key: 'instagram' as const,
    label: 'Instagram',
    icon: 'ri-instagram-line',
    placeholder: '@tuperfil',
    color: 'from-pink-500 to-orange-400',
    bg: 'bg-gradient-to-br from-pink-500 to-orange-400',
    focusBorder: 'focus:border-pink-500',
  },
  {
    key: 'tiktok' as const,
    label: 'TikTok',
    icon: 'ri-tiktok-line',
    placeholder: '@tuperfil',
    color: 'from-zinc-700 to-zinc-900',
    bg: 'bg-zinc-900',
    focusBorder: 'focus:border-zinc-500',
  },
  {
    key: 'youtube' as const,
    label: 'YouTube',
    icon: 'ri-youtube-line',
    placeholder: 'https://youtube.com/@tucanal',
    color: 'from-red-600 to-red-700',
    bg: 'bg-red-600',
    focusBorder: 'focus:border-red-500',
  },
  {
    key: 'twitter' as const,
    label: 'Twitter / X',
    icon: 'ri-twitter-x-line',
    placeholder: '@tuperfil',
    color: 'from-zinc-800 to-zinc-900',
    bg: 'bg-zinc-900',
    focusBorder: 'focus:border-zinc-500',
  },
];

export default function OnboardingStep3({ data, onUpdate, onNext, onBack }: Props) {
  const hasSocial = data.instagram || data.tiktok || data.youtube || data.twitter;

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-2xl font-black text-white">Tu presencia digital</h2>
        <p className="text-zinc-400 text-sm mt-1">Las marcas y promotoras buscan peleadores con presencia online</p>
      </div>

      {/* Why it matters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 flex-shrink-0">
            <i className="ri-lightbulb-line text-base"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">¿Por qué importa?</p>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              Los peleadores con redes sociales activas reciben <strong className="text-white">3x más contactos</strong> de promotoras y marcas. Añade al menos una red para destacar.
            </p>
          </div>
        </div>
      </div>

      {/* Social fields */}
      <div className="space-y-3">
        {socialFields.map((s) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${s.bg} text-white flex-shrink-0`}>
              <i className={`${s.icon} text-base`}></i>
            </div>
            <div className="flex-1">
              <input
                value={data[s.key]}
                onChange={(e) => onUpdate({ [s.key]: e.target.value })}
                className={`w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none ${s.focusBorder} placeholder-zinc-600`}
                placeholder={s.placeholder}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Highlight video */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          <i className="ri-video-line mr-1.5 text-red-400"></i>
          Vídeo destacado
        </label>
        <input
          value={data.highlight_video}
          onChange={(e) => onUpdate({ highlight_video: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
          placeholder="https://youtube.com/watch?v=... o https://vimeo.com/..."
        />
        <p className="text-xs text-zinc-600 mt-1">Tu mejor highlight, combate o entrenamiento</p>
      </div>

      {/* Skip hint */}
      {!hasSocial && (
        <p className="text-xs text-zinc-600 text-center">
          Puedes añadir tus redes más tarde desde tu dashboard
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line mr-1"></i>
          Atrás
        </button>
        <button
          onClick={onNext}
          className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
        >
          Continuar
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
}

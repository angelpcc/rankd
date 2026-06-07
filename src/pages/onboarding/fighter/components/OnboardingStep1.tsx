import { FighterOnboardingData } from '../page';

interface Props {
  data: FighterOnboardingData;
  onUpdate: (partial: Partial<FighterOnboardingData>) => void;
  onNext: () => void;
}

const COUNTRIES = [
  'España', 'México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Venezuela',
  'Ecuador', 'Bolivia', 'Uruguay', 'Paraguay', 'Cuba', 'República Dominicana',
  'Puerto Rico', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica',
  'Panamá', 'Brasil', 'Estados Unidos', 'Reino Unido', 'Francia', 'Alemania',
  'Italia', 'Portugal', 'Países Bajos', 'Bélgica', 'Suiza', 'Austria', 'Polonia',
  'Rumanía', 'Ucrania', 'Rusia', 'Marruecos', 'Argelia', 'Senegal', 'Nigeria',
  'Filipinas', 'Japón', 'Corea del Sur', 'Tailandia', 'Australia', 'Otro',
];

export default function OnboardingStep1({ data, onUpdate, onNext }: Props) {
  const canContinue = data.full_name.trim().length >= 2;

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-2xl font-black text-white">Cuéntanos quién eres</h2>
        <p className="text-zinc-400 text-sm mt-1">Esta información aparecerá en tu perfil público</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            value={data.full_name}
            onChange={(e) => onUpdate({ full_name: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
            placeholder="Tu nombre real"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Apodo / Nickname
          </label>
          <input
            value={data.nickname}
            onChange={(e) => onUpdate({ nickname: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
            placeholder="El Toro, The Machine, Iron Fist..."
          />
          <p className="text-xs text-zinc-600 mt-1">El apodo que te conocen en el ring</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Edad</label>
            <input
              type="number"
              min="14"
              max="60"
              value={data.age}
              onChange={(e) => onUpdate({ age: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
              placeholder="25"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">País de residencia</label>
            <select
              value={data.nationality}
              onChange={(e) => onUpdate({ nationality: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="">Selecciona país</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Ciudad</label>
          <input
            value={data.location}
            onChange={(e) => onUpdate({ location: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
            placeholder="Madrid, Buenos Aires, Ciudad de México..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Biografía</label>
          <textarea
            value={data.bio}
            onChange={(e) => onUpdate({ bio: e.target.value })}
            rows={4}
            maxLength={500}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600 resize-none"
            placeholder="Cuéntanos tu historia como peleador: cómo empezaste, tus logros, tu estilo de pelea..."
          />
          <p className="text-xs text-zinc-600 mt-1 text-right">{data.bio.length}/500</p>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
      >
        Continuar
        <i className="ri-arrow-right-line"></i>
      </button>
    </div>
  );
}
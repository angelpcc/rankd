import { useTranslation } from 'react-i18next';
import { FighterOnboardingData } from '../page';

interface Props {
  data: FighterOnboardingData;
  onUpdate: (partial: Partial<FighterOnboardingData>) => void;
  onNext: () => void;
}

const COUNTRIES = [
  // LATAM
  'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica', 'Cuba',
  'Ecuador', 'El Salvador', 'Guatemala', 'Honduras', 'México', 'Nicaragua',
  'Panamá', 'Paraguay', 'Perú', 'Puerto Rico', 'República Dominicana',
  'Uruguay', 'Venezuela',
  // Europa
  'España', 'Portugal', 'Reino Unido', 'Francia', 'Alemania', 'Italia',
  'Países Bajos', 'Bélgica', 'Suiza', 'Austria', 'Polonia', 'Rumanía',
  'Ucrania', 'Rusia', 'Suecia', 'Noruega', 'Dinamarca', 'Finlandia',
  'República Checa', 'Hungría', 'Grecia', 'Turquía',
  // Resto del mundo
  'Estados Unidos', 'Canadá', 'Marruecos', 'Argelia', 'Senegal', 'Nigeria',
  'Sudáfrica', 'Filipinas', 'Japón', 'Corea del Sur', 'Tailandia',
  'Australia', 'Nueva Zelanda', 'Otro',
];

export default function OnboardingStep1({ data, onUpdate, onNext }: Props) {
  const { t } = useTranslation();
  const canContinue = data.full_name.trim().length >= 2;

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-2xl font-black text-white">{t('onb_f_s1_title')}</h2>
        <p className="text-zinc-400 text-sm mt-1">{t('onb_f_s1_sub')}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            {t('onb_f_name')} <span className="text-red-500">*</span>
          </label>
          <input
            value={data.full_name}
            onChange={(e) => onUpdate({ full_name: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
            placeholder={t('onb_f_name_ph')}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            {t('onb_f_nick')}
          </label>
          <input
            value={data.nickname}
            onChange={(e) => onUpdate({ nickname: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
            placeholder={t('onb_f_nick_ph')}
          />
          <p className="text-xs text-zinc-600 mt-1">{t('onb_f_nick_hint')}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_f_age')}</label>
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
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_f_country')}</label>
            <select
              value={data.nationality}
              onChange={(e) => onUpdate({ nationality: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="">{t('onb_f_select_country')}</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_f_city')}</label>
          <input
            value={data.location}
            onChange={(e) => onUpdate({ location: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
            placeholder={t('onb_f_city_ph')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_f_bio')}</label>
          <textarea
            value={data.bio}
            onChange={(e) => onUpdate({ bio: e.target.value })}
            rows={4}
            maxLength={500}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600 resize-none"
            placeholder={t('onb_f_bio_ph')}
          />
          <p className="text-xs text-zinc-600 mt-1 text-right">{data.bio.length}/500</p>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
      >
        {t('onb_continue')}
        <i className="ri-arrow-right-line"></i>
      </button>
    </div>
  );
}
import { useTranslation } from 'react-i18next';
import { FighterOnboardingData } from '../page';

interface Props {
  data: FighterOnboardingData;
  onUpdate: (partial: Partial<FighterOnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const disciplines = [
  { value: 'boxing', labelKey: 'disc_boxing', icon: 'ri-boxing-line' },
  { value: 'mma', labelKey: 'disc_mma', icon: 'ri-sword-line' },
  { value: 'kickboxing', labelKey: 'disc_kickboxing', icon: 'ri-run-line' },
  { value: 'muay_thai', labelKey: 'disc_muay_thai', icon: 'ri-fire-line' },
  { value: 'wrestling', labelKey: 'disc_wrestling', icon: 'ri-shield-line' },
  { value: 'bjj', labelKey: 'disc_bjj', icon: 'ri-medal-line' },
  { value: 'other', labelKey: 'disc_other', icon: 'ri-more-line' },
];

// Categorías de peso: valores canónicos almacenados y mostrados igual en toda
// la app (ficha, directorio). No se traducen para no desincronizar el dato.
const weightClasses = [
  'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];

const expLevels = [
  { value: 'amateur', labelKey: 'exp_amateur', descKey: 'onb_f_exp_amateur_desc' },
  { value: 'semi_pro', labelKey: 'exp_semipro', descKey: 'onb_f_exp_semipro_desc' },
  { value: 'professional', labelKey: 'exp_professional', descKey: 'onb_f_exp_pro_desc' },
];

// "Qué buscas": valores canónicos almacenados (looking_for), mostrados igual en
// la ficha pública. No se traducen para no desincronizar el dato.
const lookingForOptions = ['Combates', 'Contrato profesional', 'Patrocinio', 'Manager', 'Promotora', 'Entrenamiento'];

export default function OnboardingStep2({ data, onUpdate, onNext, onBack }: Props) {
  const { t } = useTranslation();
  const canContinue = !!data.discipline && !!data.weight_class;

  const toggleLookingFor = (item: string) => {
    onUpdate({
      looking_for: data.looking_for.includes(item)
        ? data.looking_for.filter((x) => x !== item)
        : [...data.looking_for, item],
    });
  };

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-2xl font-black text-white">{t('onb_f_s2_title')}</h2>
        <p className="text-zinc-400 text-sm mt-1">{t('onb_f_s2_sub')}</p>
      </div>

      {/* Discipline */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          {t('onb_f_discipline')} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {disciplines.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onUpdate({ discipline: d.value })}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                data.discipline === d.value
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              <i className={`${d.icon} text-lg`}></i>
              {t(d.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Weight class */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          {t('onb_f_weight')} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {weightClasses.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onUpdate({ weight_class: w })}
              className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                data.weight_class === w
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Experience level */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">{t('onb_f_exp')}</label>
        <div className="space-y-2">
          {expLevels.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => onUpdate({ experience_level: e.value })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                data.experience_level === e.value
                  ? 'bg-red-600/10 border-red-500/50 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${data.experience_level === e.value ? 'border-red-500' : 'border-zinc-600'}`}>
                {data.experience_level === e.value && <div className="w-2 h-2 rounded-full bg-red-500"></div>}
              </div>
              <div>
                <p className="text-sm font-semibold">{t(e.labelKey)}</p>
                <p className="text-xs text-zinc-500">{t(e.descKey)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Record */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">{t('onb_f_record')}</label>
        <div className="grid grid-cols-4 gap-3">
          {[
            { labelKey: 'onb_f_wins', key: 'wins' as const, color: 'text-green-400' },
            { labelKey: 'onb_f_losses', key: 'losses' as const, color: 'text-red-400' },
            { labelKey: 'onb_f_draws', key: 'draws' as const, color: 'text-yellow-400' },
            { labelKey: 'onb_f_kos', key: 'kos' as const, color: 'text-orange-400' },
          ].map((s) => (
            <div key={s.key} className="text-center">
              <p className={`text-xs font-semibold mb-1.5 ${s.color}`}>{t(s.labelKey)}</p>
              <input
                type="number"
                min="0"
                value={data[s.key]}
                onChange={(e) => onUpdate({ [s.key]: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 text-center"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Gym + Coach */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_f_gym')}</label>
          <input
            value={data.gym}
            onChange={(e) => onUpdate({ gym: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
            placeholder={t('onb_f_gym_ph')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_f_coach')}</label>
          <input
            value={data.coach}
            onChange={(e) => onUpdate({ coach: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
            placeholder={t('onb_f_coach_ph')}
          />
        </div>
      </div>

      {/* Looking for */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">{t('onb_f_looking')}</label>
        <div className="flex flex-wrap gap-2">
          {lookingForOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleLookingFor(opt)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer whitespace-nowrap font-medium ${
                data.looking_for.includes(opt)
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line mr-1"></i>
          {t('onb_back')}
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="flex-[2] bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
        >
          {t('onb_continue')}
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
}

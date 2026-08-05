import { useTranslation } from 'react-i18next';

interface Filters {
  discipline: string;
  weightClass: string;
  expLevel: string;
  available: boolean;
  hasSocial: boolean;
  location: string;
  popularity: string;
  search: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  total: number;
  filtered: number;
  locations: string[];
  sortBy: string;
  onSortChange: (sort: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

// Etiquetas por clave i18n: disciplinas y niveles reutilizan el set compartido
// (disc_*/exp_*); el resto usa el namespace del directorio (fd_*).
const disciplines = [
  { value: '', labelKey: 'fd_all_disciplines' },
  { value: 'boxing', labelKey: 'disc_boxing' },
  { value: 'mma', labelKey: 'disc_mma' },
  { value: 'kickboxing', labelKey: 'disc_kickboxing' },
  { value: 'muay_thai', labelKey: 'disc_muay_thai' },
  { value: 'wrestling', labelKey: 'disc_wrestling' },
  { value: 'bjj', labelKey: 'disc_bjj' },
  { value: 'other', labelKey: 'disc_other' },
];

// Categorías de peso: valores canónicos almacenados → no se traducen.
const weightClasses = [
  'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];

const expLevels = [
  { value: 'amateur', labelKey: 'exp_amateur' },
  { value: 'semi_pro', labelKey: 'exp_semipro' },
  { value: 'professional', labelKey: 'exp_professional' },
];

const popularityOptions = [
  { value: '', labelKey: 'fd_pop_any' },
  { value: 'high', labelKey: 'fd_pop_high' },
  { value: 'medium', labelKey: 'fd_pop_medium' },
  { value: 'none', labelKey: 'fd_pop_none' },
];

const sortOptions = [
  { value: 'recent', labelKey: 'fd_sort_recent' },
  { value: 'wins', labelKey: 'fd_most_wins' },
  { value: 'social', labelKey: 'fd_most_social' },
  { value: 'available', labelKey: 'fd_sort_available' },
];

export type { Filters };

export default function FightersFilters({
  filters, onChange, total, filtered, locations, sortBy, onSortChange, isOpen, onToggle,
}: Props) {
  const { t } = useTranslation();
  const set = (key: keyof Filters, value: string | boolean) => onChange({ ...filters, [key]: value });

  const activeCount = [
    filters.discipline, filters.weightClass, filters.expLevel,
    filters.location, filters.popularity,
    filters.available ? 'x' : '',
    filters.hasSocial ? 'x' : '',
  ].filter(Boolean).length;

  const clearAll = () => onChange({
    discipline: '', weightClass: '', expLevel: '', available: false,
    hasSocial: false, location: '', popularity: '', search: '',
  });

  return (
    <div className="w-full lg:w-64 flex-shrink-0">
      {/* Mobile toggle */}
      <button
        onClick={onToggle}
        className="lg:hidden w-full flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 mb-3 cursor-pointer"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <i className="ri-filter-3-line text-[#C9A84C]"></i>
          {t('fd_filters')}
          {activeCount > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{activeCount}</span>
          )}
        </span>
        {isOpen ? <i className="ri-arrow-up-s-line text-zinc-400"></i> : <i className="ri-arrow-down-s-line text-zinc-400"></i>}
      </button>

      <div className={`${isOpen ? 'block' : 'hidden'} lg:block space-y-3`}>
        {/* Header */}
        <div className="hidden lg:flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <i className="ri-filter-3-line text-[#C9A84C]"></i>
            {t('fd_filters')}
            {activeCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{activeCount}</span>
            )}
          </span>
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap transition-colors">
              {t('fd_clear_all')}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
              placeholder={t('fd_search_ph')}
              className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>
        </div>

        {/* País — ARRIBA */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-[0.18em] mb-3">{t('fd_country')}</p>
          <select
            value={filters.location}
            onChange={(e) => set('location', e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="">{t('fd_all_countries')}</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-[0.18em] mb-3">{t('fd_sort_by')}</p>
          <div className="space-y-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer ${sortBy === opt.value ? 'bg-red-600/15 text-red-400 font-semibold' : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'}`}
              >
                {opt.value === 'recent' && <i className="ri-time-line mr-2 text-xs"></i>}
                {opt.value === 'wins' && <i className="ri-trophy-line mr-2 text-xs"></i>}
                {opt.value === 'social' && <i className="ri-global-line mr-2 text-xs"></i>}
                {opt.value === 'available' && <i className="ri-checkbox-circle-line mr-2 text-xs"></i>}
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Discipline */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-[0.18em] mb-3">{t('fd_discipline')}</p>
          <div className="space-y-1">
            {disciplines.map((d) => (
              <button
                key={d.value}
                onClick={() => set('discipline', filters.discipline === d.value ? '' : d.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer ${filters.discipline === d.value && d.value !== '' ? 'bg-red-600/15 text-red-400 font-semibold' : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'}`}
              >
                {t(d.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Weight class */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-[0.18em] mb-3">{t('fd_weight_class')}</p>
          <select
            value={filters.weightClass}
            onChange={(e) => set('weightClass', e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="">{t('fd_all_weights')}</option>
            {weightClasses.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        {/* Experience level */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-[0.18em] mb-3">{t('fd_level')}</p>
          <div className="space-y-1">
            {expLevels.map((e) => (
              <button
                key={e.value}
                onClick={() => set('expLevel', filters.expLevel === e.value ? '' : e.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${filters.expLevel === e.value ? 'bg-red-600/15 text-red-400 font-semibold' : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'}`}
              >
                <span>{t(e.labelKey)}</span>
                {filters.expLevel === e.value && <i className="ri-check-line text-xs"></i>}
              </button>
            ))}
          </div>
        </div>

        {/* Popularity / Social */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-[0.18em] mb-3">{t('fd_digital')}</p>
          <div className="space-y-1 mb-3">
            {popularityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set('popularity', filters.popularity === opt.value ? '' : opt.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${filters.popularity === opt.value && opt.value !== '' ? 'bg-red-600/15 text-red-400 font-semibold' : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'}`}
              >
                <span>{t(opt.labelKey)}</span>
                {filters.popularity === opt.value && opt.value !== '' && <i className="ri-check-line text-xs"></i>}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors">
            <button
              type="button"
              onClick={() => set('hasSocial', !filters.hasSocial)}
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${filters.hasSocial ? 'bg-red-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${filters.hasSocial ? 'left-4' : 'left-0.5'}`}></span>
            </button>
            <span className="text-sm text-zinc-300">{t('fd_with_social')}</span>
          </label>
        </div>

        {/* Availability */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
          <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-[0.18em] mb-3">{t('fd_availability')}</p>
          <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors">
            <button
              type="button"
              onClick={() => set('available', !filters.available)}
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${filters.available ? 'bg-green-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${filters.available ? 'left-4' : 'left-0.5'}`}></span>
            </button>
            <span className="text-sm text-zinc-300">{t('fd_only_available')}</span>
          </label>
        </div>

        {/* Results count */}
        <div className="bg-gradient-to-br from-red-600/10 to-transparent border border-red-500/20 rounded-xl px-4 py-3 text-center">
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, lineHeight: 1, color: '#fff' }}>{filtered}</p>
          <p className="text-xs text-zinc-400 mt-1">{filtered === 1 ? t('fd_found_one') : t('fd_found_other')}</p>
          {filtered !== total && (
            <p className="text-xs text-zinc-500 mt-0.5">{t('fd_of_total', { n: total })}</p>
          )}
        </div>

        {/* Mobile clear */}
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="lg:hidden w-full text-sm text-red-400 hover:text-red-300 cursor-pointer py-2 transition-colors font-medium"
          >
            {t('fd_clear_all_mobile')}
          </button>
        )}
      </div>
    </div>
  );
}
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

const disciplines = [
  { value: '', label: 'Todas las disciplinas' },
  { value: 'boxing', label: 'Boxeo' },
  { value: 'mma', label: 'MMA' },
  { value: 'kickboxing', label: 'Kickboxing' },
  { value: 'muay_thai', label: 'Muay Thai' },
  { value: 'wrestling', label: 'Wrestling' },
  { value: 'bjj', label: 'BJJ' },
  { value: 'other', label: 'Otro' },
];

const weightClasses = [
  'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];

const expLevels = [
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi_pro', label: 'Semi-Pro' },
  { value: 'professional', label: 'Profesional' },
];

const popularityOptions = [
  { value: '', label: 'Cualquier popularidad' },
  { value: 'high', label: 'Alta (3+ redes)' },
  { value: 'medium', label: 'Media (1-2 redes)' },
  { value: 'none', label: 'Sin redes sociales' },
];

const sortOptions = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'wins', label: 'Más victorias' },
  { value: 'social', label: 'Mayor presencia digital' },
  { value: 'available', label: 'Disponibles primero' },
];

export type { Filters };

export default function FightersFilters({
  filters, onChange, total, filtered, locations, sortBy, onSortChange, isOpen, onToggle,
}: Props) {
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
        className="lg:hidden w-full flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-4 py-3 mb-3 cursor-pointer"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
          <i className="ri-filter-3-line"></i>
          Filtros
          {activeCount > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{activeCount}</span>
          )}
        </span>
        {isOpen ? <i className="ri-arrow-up-s-line text-zinc-400"></i> : <i className="ri-arrow-down-s-line text-zinc-400"></i>}
      </button>

      <div className={`${isOpen ? 'block' : 'hidden'} lg:block space-y-3`}>
        {/* Header */}
        <div className="hidden lg:flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-zinc-800 flex items-center gap-2">
            <i className="ri-filter-3-line text-red-500"></i>
            Filtros
            {activeCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{activeCount}</span>
            )}
          </span>
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 cursor-pointer whitespace-nowrap transition-colors">
              Limpiar todo
            </button>
          )}
        </div>

        {/* Search */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
              placeholder="Nombre, apodo, gimnasio..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm rounded-lg focus:outline-none focus:border-red-400 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* País — ARRIBA */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">País</p>
          <select
            value={filters.location}
            onChange={(e) => set('location', e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-400 cursor-pointer"
          >
            <option value="">Todos los países</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Ordenar por</p>
          <div className="space-y-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer ${sortBy === opt.value ? 'bg-red-50 text-red-600 font-semibold' : 'text-zinc-600 hover:bg-zinc-50'}`}
              >
                {opt.value === 'recent' && <i className="ri-time-line mr-2 text-xs"></i>}
                {opt.value === 'wins' && <i className="ri-trophy-line mr-2 text-xs"></i>}
                {opt.value === 'social' && <i className="ri-global-line mr-2 text-xs"></i>}
                {opt.value === 'available' && <i className="ri-checkbox-circle-line mr-2 text-xs"></i>}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Discipline */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Disciplina</p>
          <div className="space-y-1">
            {disciplines.map((d) => (
              <button
                key={d.value}
                onClick={() => set('discipline', filters.discipline === d.value ? '' : d.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer ${filters.discipline === d.value && d.value !== '' ? 'bg-red-50 text-red-600 font-semibold' : 'text-zinc-600 hover:bg-zinc-50'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Weight class */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Categoría de peso</p>
          <select
            value={filters.weightClass}
            onChange={(e) => set('weightClass', e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-400 cursor-pointer"
          >
            <option value="">Todas las categorías</option>
            {weightClasses.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        {/* Experience level */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Nivel</p>
          <div className="space-y-1">
            {expLevels.map((e) => (
              <button
                key={e.value}
                onClick={() => set('expLevel', filters.expLevel === e.value ? '' : e.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${filters.expLevel === e.value ? 'bg-red-50 text-red-600 font-semibold' : 'text-zinc-600 hover:bg-zinc-50'}`}
              >
                <span>{e.label}</span>
                {filters.expLevel === e.value && <i className="ri-check-line text-xs"></i>}
              </button>
            ))}
          </div>
        </div>

        {/* Popularity / Social */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Presencia digital</p>
          <div className="space-y-1 mb-3">
            {popularityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set('popularity', filters.popularity === opt.value ? '' : opt.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${filters.popularity === opt.value && opt.value !== '' ? 'bg-red-50 text-red-600 font-semibold' : 'text-zinc-600 hover:bg-zinc-50'}`}
              >
                <span>{opt.label}</span>
                {filters.popularity === opt.value && opt.value !== '' && <i className="ri-check-line text-xs"></i>}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
            <button
              type="button"
              onClick={() => set('hasSocial', !filters.hasSocial)}
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${filters.hasSocial ? 'bg-red-500' : 'bg-zinc-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${filters.hasSocial ? 'left-4' : 'left-0.5'}`}></span>
            </button>
            <span className="text-sm text-zinc-600">Con redes sociales</span>
          </label>
        </div>

        {/* Availability */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Disponibilidad</p>
          <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
            <button
              type="button"
              onClick={() => set('available', !filters.available)}
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${filters.available ? 'bg-green-500' : 'bg-zinc-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${filters.available ? 'left-4' : 'left-0.5'}`}></span>
            </button>
            <span className="text-sm text-zinc-600">Solo disponibles</span>
          </label>
        </div>

        {/* Results count */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-center">
          <p className="text-sm font-bold text-zinc-800">{filtered}</p>
          <p className="text-xs text-zinc-400">{filtered === 1 ? 'peleador encontrado' : 'peleadores encontrados'}</p>
          {filtered !== total && (
            <p className="text-xs text-zinc-400 mt-0.5">de {total} en total</p>
          )}
        </div>

        {/* Mobile clear */}
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="lg:hidden w-full text-sm text-red-500 hover:text-red-700 cursor-pointer py-2 transition-colors font-medium"
          >
            Limpiar todos los filtros
          </button>
        )}
      </div>
    </div>
  );
}
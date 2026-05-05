const opportunityTypes = [
  { value: '', label: 'Todos los tipos' },
  { value: 'combate', label: 'Combate' },
  { value: 'sparring', label: 'Sparring' },
  { value: 'campamento', label: 'Campamento' },
  { value: 'entrenamiento', label: 'Entrenamiento' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'patrocinio', label: 'Patrocinio' },
  { value: 'scouting', label: 'Scouting' },
];

const disciplines = [
  { value: '', label: 'Todas las disciplinas' },
  { value: 'boxing', label: 'Boxeo' },
  { value: 'mma', label: 'MMA' },
  { value: 'kickboxing', label: 'Kickboxing' },
  { value: 'muay_thai', label: 'Muay Thai' },
  { value: 'wrestling', label: 'Wrestling' },
  { value: 'bjj', label: 'BJJ' },
];

const weightClasses = [
  '', 'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];

interface Props {
  filterType: string; setFilterType: (v: string) => void;
  filterDiscipline: string; setFilterDiscipline: (v: string) => void;
  filterWeight: string; setFilterWeight: (v: string) => void;
  filterLocation: string; setFilterLocation: (v: string) => void;
}

export default function OpportunitiesFilters({ filterType, setFilterType, filterDiscipline, setFilterDiscipline, filterWeight, setFilterWeight, filterLocation, setFilterLocation }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="bg-white border border-zinc-200 text-zinc-700 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-400 cursor-pointer"
      >
        {opportunityTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <select
        value={filterDiscipline}
        onChange={(e) => setFilterDiscipline(e.target.value)}
        className="bg-white border border-zinc-200 text-zinc-700 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-400 cursor-pointer"
      >
        {disciplines.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>

      <select
        value={filterWeight}
        onChange={(e) => setFilterWeight(e.target.value)}
        className="bg-white border border-zinc-200 text-zinc-700 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-400 cursor-pointer"
      >
        <option value="">Todas las categorías</option>
        {weightClasses.filter(Boolean).map((w) => <option key={w} value={w}>{w}</option>)}
      </select>

      <input
        value={filterLocation}
        onChange={(e) => setFilterLocation(e.target.value)}
        placeholder="Ubicación..."
        className="bg-white border border-zinc-200 text-zinc-700 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-400"
      />
    </div>
  );
}

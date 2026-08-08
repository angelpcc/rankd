import { useTranslation } from 'react-i18next';

const opportunityTypes = [
  { value: '', labelKey: 'opp_type_all' },
  { value: 'combate', labelKey: 'opp_type_combate' },
  { value: 'sparring', labelKey: 'opp_type_sparring' },
  { value: 'campamento', labelKey: 'opp_type_campamento' },
  { value: 'entrenamiento', labelKey: 'opp_type_entrenamiento' },
  { value: 'contrato', labelKey: 'opp_type_contrato' },
  { value: 'patrocinio', labelKey: 'opp_type_patrocinio' },
  { value: 'scouting', labelKey: 'opp_type_scouting' },
];

const disciplines = [
  { value: '', labelKey: 'fd_all_disciplines' },
  { value: 'boxing', labelKey: 'disc_boxing' },
  { value: 'mma', labelKey: 'disc_mma' },
  { value: 'kickboxing', labelKey: 'disc_kickboxing' },
  { value: 'muay_thai', labelKey: 'disc_muay_thai' },
  { value: 'wrestling', labelKey: 'disc_wrestling' },
  { value: 'bjj', labelKey: 'disc_bjj' },
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
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
        style={{ fontSize: 16, minHeight: 44 }}
      >
        {opportunityTypes.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
      </select>

      <select
        value={filterDiscipline}
        onChange={(e) => setFilterDiscipline(e.target.value)}
        className="bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
        style={{ fontSize: 16, minHeight: 44 }}
      >
        {disciplines.map((d) => <option key={d.value} value={d.value}>{t(d.labelKey)}</option>)}
      </select>

      <select
        value={filterWeight}
        onChange={(e) => setFilterWeight(e.target.value)}
        className="bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 focus:outline-none focus:border-red-500 cursor-pointer transition-colors"
        style={{ fontSize: 16, minHeight: 44 }}
      >
        <option value="">{t('fd_all_weights')}</option>
        {weightClasses.filter(Boolean).map((w) => <option key={w} value={w}>{w}</option>)}
      </select>

      <input
        value={filterLocation}
        onChange={(e) => setFilterLocation(e.target.value)}
        placeholder={t('op_location_ph')}
        className="bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 focus:outline-none focus:border-red-500 transition-colors placeholder:text-zinc-500"
        style={{ fontSize: 16, minHeight: 44 }}
      />
    </div>
  );
}

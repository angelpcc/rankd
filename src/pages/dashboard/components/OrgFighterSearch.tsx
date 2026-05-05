import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Profile, Fighter } from '@/lib/supabase';

interface FighterWithProfile {
  fighter: Fighter;
  profile: Profile;
}

interface Props {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};
const disciplineColors: Record<string, string> = {
  boxing: 'bg-red-500/10 text-red-400 border-red-500/20',
  mma: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  kickboxing: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  muay_thai: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  wrestling: 'bg-zinc-700 text-zinc-300 border-zinc-600',
  bjj: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  other: 'bg-zinc-700 text-zinc-300 border-zinc-600',
};
const expLabels: Record<string, string> = {
  amateur: 'Amateur', semi_pro: 'Semi-Pro', professional: 'Profesional',
};

const weightClasses = [
  '', 'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];

export default function OrgFighterSearch({ showToast }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<FighterWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterWeight, setFilterWeight] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [contactingId, setContactingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: fighters } = await supabase
        .from('fighters')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fighters || fighters.length === 0) { setLoading(false); return; }

      const profileIds = fighters.map((f) => f.profile_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);

      if (!profiles) { setLoading(false); return; }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const combined: FighterWithProfile[] = fighters
        .map((f) => ({ fighter: f, profile: profileMap.get(f.profile_id) as Profile }))
        .filter((item) => item.profile);

      setData(combined);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return data.filter(({ fighter, profile }) => {
      if (filterDiscipline && fighter.discipline !== filterDiscipline) return false;
      if (filterWeight && fighter.weight_class !== filterWeight) return false;
      if (filterLevel && fighter.experience_level !== filterLevel) return false;
      if (filterAvailable && !fighter.is_available) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (profile.full_name || '').toLowerCase();
        const nick = (fighter.nickname || '').toLowerCase();
        const gym = (fighter.gym || '').toLowerCase();
        const nat = (fighter.nationality || '').toLowerCase();
        const loc = (profile.location || '').toLowerCase();
        if (!name.includes(q) && !nick.includes(q) && !gym.includes(q) && !nat.includes(q) && !loc.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, filterDiscipline, filterWeight, filterLevel, filterAvailable]);

  const clearFilters = () => {
    setSearch('');
    setFilterDiscipline('');
    setFilterWeight('');
    setFilterLevel('');
    setFilterAvailable(false);
  };

  const hasFilters = search || filterDiscipline || filterWeight || filterLevel || filterAvailable;

  const handleContact = (fighter: FighterWithProfile) => {
    setContactingId(fighter.fighter.id);
    setTimeout(() => {
      navigate(`/fighter/${fighter.fighter.id}`);
    }, 300);
  };

  const disciplines = [
    { value: 'boxing', label: 'Boxeo' },
    { value: 'mma', label: 'MMA' },
    { value: 'kickboxing', label: 'Kickboxing' },
    { value: 'muay_thai', label: 'Muay Thai' },
    { value: 'wrestling', label: 'Wrestling' },
    { value: 'bjj', label: 'BJJ' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Buscar Peleadores</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {loading ? '...' : `${filtered.length} de ${data.length} peleadores`}
          </p>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className="ri-filter-off-line"></i>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, apodo, gimnasio, país..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-red-500 placeholder-zinc-500"
          />
        </div>

        {/* Filter row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="">Disciplina</option>
            {disciplines.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>

          <select
            value={filterWeight}
            onChange={(e) => setFilterWeight(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="">Categoría de peso</option>
            {weightClasses.filter(Boolean).map((w) => <option key={w} value={w}>{w}</option>)}
          </select>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="">Nivel</option>
            <option value="amateur">Amateur</option>
            <option value="semi_pro">Semi-Pro</option>
            <option value="professional">Profesional</option>
          </select>

          <button
            onClick={() => setFilterAvailable(!filterAvailable)}
            className={`flex items-center justify-center gap-1.5 text-xs rounded-xl px-3 py-2 border transition-all cursor-pointer whitespace-nowrap ${filterAvailable ? 'bg-green-600/20 border-green-500/40 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${filterAvailable ? 'bg-green-400' : 'bg-zinc-500'}`}></span>
            Solo disponibles
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600">
            <i className="ri-user-search-line text-4xl"></i>
          </div>
          <p className="text-zinc-400 text-sm">Aún no hay peleadores registrados en la plataforma.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600">
            <i className="ri-filter-off-line text-4xl"></i>
          </div>
          <p className="text-zinc-400 text-sm">Sin resultados con estos filtros.</p>
          <button onClick={clearFilters} className="mt-3 text-xs text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ fighter, profile }) => {
            const initials = (profile.full_name || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            const discColor = disciplineColors[fighter.discipline || ''] || disciplineColors.other;

            return (
              <div
                key={fighter.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-zinc-700 transition-colors"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-14 h-14 rounded-xl object-cover object-top" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-base font-black">
                      {initials}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{profile.full_name || 'Peleador'}</p>
                        {fighter.nickname && <span className="text-xs text-red-400 italic">&ldquo;{fighter.nickname}&rdquo;</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${fighter.is_available ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${fighter.is_available ? 'bg-green-400' : 'bg-zinc-500'}`}></span>
                          {fighter.is_available ? 'Disponible' : 'No disponible'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {fighter.discipline && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${discColor}`}>
                            {disciplineLabels[fighter.discipline] || fighter.discipline}
                          </span>
                        )}
                        {fighter.weight_class && <span className="text-xs text-zinc-400">{fighter.weight_class}</span>}
                        {fighter.experience_level && <span className="text-xs text-zinc-500">· {expLabels[fighter.experience_level] || fighter.experience_level}</span>}
                        {(fighter.nationality || profile.location) && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <i className="ri-map-pin-line"></i>
                            {fighter.nationality}{fighter.nationality && profile.location ? ', ' : ''}{profile.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Record */}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-green-400">{fighter.wins}V</span>
                      <span className="text-xs font-bold text-red-400">{fighter.losses}D</span>
                      <span className="text-xs font-bold text-yellow-400">{fighter.draws}E</span>
                      <span className="text-xs font-bold text-orange-400">{fighter.kos} KO</span>
                    </div>
                    {fighter.gym && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1 truncate">
                        <i className="ri-building-4-line"></i>{fighter.gym}
                      </span>
                    )}
                  </div>

                  {/* Looking for */}
                  {fighter.looking_for && fighter.looking_for.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-xs text-zinc-600">Busca:</span>
                      {fighter.looking_for.slice(0, 3).map((item) => (
                        <span key={item} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/fighter/${fighter.id}`)}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-eye-line"></i>
                    Ver perfil
                  </button>
                  <button
                    onClick={() => handleContact({ fighter, profile })}
                    disabled={contactingId === fighter.id}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    <i className="ri-send-plane-line"></i>
                    Contactar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

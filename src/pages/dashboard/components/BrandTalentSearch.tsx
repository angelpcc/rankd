import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Profile, Fighter } from '@/lib/supabase';

interface FighterWithProfile {
  fighter: Fighter;
  profile: Profile;
  score: number;
}

interface Props {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};
const disciplineColors: Record<string, string> = {
  boxing: 'bg-red-500/15 text-red-400 border-red-500/25',
  mma: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  kickboxing: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  muay_thai: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  wrestling: 'bg-zinc-700 text-zinc-300 border-zinc-600',
  bjj: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  other: 'bg-zinc-700 text-zinc-300 border-zinc-600',
};
const expLabels: Record<string, string> = {
  amateur: 'Amateur', semi_pro: 'Semi-Pro', professional: 'Profesional',
};
const weightClasses = [
  '', 'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];

// Simulated popularity score based on record + availability
function calcScore(f: Fighter, p: Profile): number {
  let s = 0;
  s += (f.wins || 0) * 3;
  s += (f.kos || 0) * 5;
  s -= (f.losses || 0) * 1;
  if (f.is_available) s += 10;
  if (f.experience_level === 'professional') s += 20;
  else if (f.experience_level === 'semi_pro') s += 10;
  if (p.instagram) s += 8;
  if (p.youtube) s += 6;
  if (p.twitter) s += 4;
  if (f.highlight_video) s += 5;
  return Math.max(0, s);
}

// Fake follower count derived from score for display
function fakeFollowers(score: number): string {
  const base = score * 420 + 1200;
  if (base >= 1_000_000) return `${(base / 1_000_000).toFixed(1)}M`;
  if (base >= 1_000) return `${Math.round(base / 1_000)}K`;
  return `${base}`;
}

type SortMode = 'popularity' | 'wins' | 'recent' | 'available';

export default function BrandTalentSearch({ showToast }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<FighterWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterWeight, setFilterWeight] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [filterHasSocial, setFilterHasSocial] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('popularity');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFighter, setSelectedFighter] = useState<FighterWithProfile | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: fighters } = await supabase.from('fighters').select('*');
      if (!fighters || fighters.length === 0) { setLoading(false); return; }
      const profileIds = fighters.map((f) => f.profile_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', profileIds);
      if (!profiles) { setLoading(false); return; }
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const combined: FighterWithProfile[] = fighters
        .map((f) => {
          const p = profileMap.get(f.profile_id) as Profile;
          return p ? { fighter: f, profile: p, score: calcScore(f, p) } : null;
        })
        .filter(Boolean) as FighterWithProfile[];
      setData(combined);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = data.filter(({ fighter, profile }) => {
      if (filterDiscipline && fighter.discipline !== filterDiscipline) return false;
      if (filterWeight && fighter.weight_class !== filterWeight) return false;
      if (filterLevel && fighter.experience_level !== filterLevel) return false;
      if (filterAvailable && !fighter.is_available) return false;
      if (filterHasSocial && !profile.instagram && !profile.youtube && !profile.twitter) return false;
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

    result = [...result].sort((a, b) => {
      if (sortMode === 'popularity') return b.score - a.score;
      if (sortMode === 'wins') return b.fighter.wins - a.fighter.wins;
      if (sortMode === 'available') return (b.fighter.is_available ? 1 : 0) - (a.fighter.is_available ? 1 : 0);
      return new Date(b.fighter.created_at).getTime() - new Date(a.fighter.created_at).getTime();
    });

    return result;
  }, [data, search, filterDiscipline, filterWeight, filterLevel, filterAvailable, filterHasSocial, sortMode]);

  const clearFilters = () => {
    setSearch(''); setFilterDiscipline(''); setFilterWeight('');
    setFilterLevel(''); setFilterAvailable(false); setFilterHasSocial(false);
  };
  const hasFilters = search || filterDiscipline || filterWeight || filterLevel || filterAvailable || filterHasSocial;

  const disciplines = [
    { value: 'boxing', label: 'Boxeo' }, { value: 'mma', label: 'MMA' },
    { value: 'kickboxing', label: 'Kickboxing' }, { value: 'muay_thai', label: 'Muay Thai' },
    { value: 'wrestling', label: 'Wrestling' }, { value: 'bjj', label: 'BJJ' },
  ];

  const sortOptions: { value: SortMode; label: string; icon: string }[] = [
    { value: 'popularity', label: 'Popularidad', icon: 'ri-fire-line' },
    { value: 'wins', label: 'Victorias', icon: 'ri-trophy-line' },
    { value: 'available', label: 'Disponibles', icon: 'ri-checkbox-circle-line' },
    { value: 'recent', label: 'Recientes', icon: 'ri-time-line' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Descubrir Talento</h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            {loading ? '...' : `${filtered.length} atletas encontrados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors">
              <i className="ri-filter-off-line"></i> Limpiar
            </button>
          )}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button onClick={() => setViewMode('grid')} className={`w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-colors ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <i className="ri-grid-line text-sm"></i>
            </button>
            <button onClick={() => setViewMode('list')} className={`w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <i className="ri-list-check text-sm"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="relative">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar atleta por nombre, apodo, país, gimnasio..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-yellow-500 placeholder-zinc-500"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <select value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-500 cursor-pointer">
            <option value="">Disciplina</option>
            {disciplines.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <select value={filterWeight} onChange={(e) => setFilterWeight(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-500 cursor-pointer">
            <option value="">Peso</option>
            {weightClasses.filter(Boolean).map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-500 cursor-pointer">
            <option value="">Nivel</option>
            <option value="amateur">Amateur</option>
            <option value="semi_pro">Semi-Pro</option>
            <option value="professional">Profesional</option>
          </select>
          <button onClick={() => setFilterAvailable(!filterAvailable)}
            className={`flex items-center justify-center gap-1.5 text-xs rounded-xl px-3 py-2 border transition-all cursor-pointer whitespace-nowrap ${filterAvailable ? 'bg-green-600/20 border-green-500/40 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${filterAvailable ? 'bg-green-400' : 'bg-zinc-500'}`}></span>
            Disponibles
          </button>
          <button onClick={() => setFilterHasSocial(!filterHasSocial)}
            className={`flex items-center justify-center gap-1.5 text-xs rounded-xl px-3 py-2 border transition-all cursor-pointer whitespace-nowrap ${filterHasSocial ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
            <i className="ri-instagram-line"></i>
            Con redes
          </button>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-yellow-500 cursor-pointer">
            {sortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Sort pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500">Ordenar:</span>
        {sortOptions.map((s) => (
          <button key={s.value} onClick={() => setSortMode(s.value)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap ${sortMode === s.value ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
            <i className={s.icon}></i>{s.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600"><i className="ri-user-search-line text-4xl"></i></div>
          <p className="text-zinc-400 text-sm">Aún no hay atletas registrados en la plataforma.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600"><i className="ri-filter-off-line text-4xl"></i></div>
          <p className="text-zinc-400 text-sm">Sin resultados con estos filtros.</p>
          <button onClick={clearFilters} className="mt-3 text-xs text-yellow-400 hover:text-yellow-300 cursor-pointer whitespace-nowrap">Limpiar filtros</button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(({ fighter, profile, score }) => {
            const initials = (profile.full_name || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            const discColor = disciplineColors[fighter.discipline || ''] || disciplineColors.other;
            const followers = fakeFollowers(score);
            const hasSocial = profile.instagram || profile.youtube || profile.twitter;
            const winRate = fighter.wins + fighter.losses > 0
              ? Math.round((fighter.wins / (fighter.wins + fighter.losses)) * 100)
              : 0;

            return (
              <div key={fighter.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-all group">
                {/* Card header */}
                <div className="relative bg-gradient-to-br from-zinc-800 to-zinc-900 p-5 pb-4">
                  {/* Popularity badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-xs px-2 py-1 rounded-full">
                    <i className="ri-fire-line text-xs"></i>
                    <span className="font-semibold">{followers}</span>
                  </div>

                  <div className="flex items-start gap-3">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-14 h-14 rounded-xl object-cover object-top flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-base font-black flex-shrink-0">
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{profile.full_name || 'Atleta'}</p>
                      {fighter.nickname && <p className="text-xs text-yellow-400 italic truncate">&ldquo;{fighter.nickname}&rdquo;</p>}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {fighter.discipline && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${discColor}`}>
                            {disciplineLabels[fighter.discipline]}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${fighter.is_available ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${fighter.is_available ? 'bg-green-400' : 'bg-zinc-500'}`}></span>
                          {fighter.is_available ? 'Disponible' : 'No disponible'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {(fighter.nationality || profile.location) && (
                    <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                      <i className="ri-map-pin-line"></i>
                      {fighter.nationality}{fighter.nationality && profile.location ? ', ' : ''}{profile.location}
                    </p>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 divide-x divide-zinc-800 border-t border-zinc-800">
                  {[
                    { label: 'V', value: fighter.wins, color: 'text-green-400' },
                    { label: 'D', value: fighter.losses, color: 'text-red-400' },
                    { label: 'KO', value: fighter.kos, color: 'text-orange-400' },
                    { label: 'Win%', value: `${winRate}%`, color: 'text-yellow-400' },
                  ].map((s) => (
                    <div key={s.label} className="py-2.5 text-center">
                      <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-zinc-600">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Social & info */}
                <div className="px-5 py-3 space-y-2.5">
                  {/* Level + weight */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {fighter.experience_level && (
                      <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                        {expLabels[fighter.experience_level] || fighter.experience_level}
                      </span>
                    )}
                    {fighter.weight_class && (
                      <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">{fighter.weight_class}</span>
                    )}
                    {fighter.gym && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1 truncate">
                        <i className="ri-building-4-line"></i>{fighter.gym}
                      </span>
                    )}
                  </div>

                  {/* Social links */}
                  {hasSocial && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600">Redes:</span>
                      {profile.instagram && (
                        <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="nofollow noreferrer"
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-pink-400 transition-colors cursor-pointer">
                          <i className="ri-instagram-line"></i>
                          <span className="truncate max-w-[80px]">{profile.instagram}</span>
                        </a>
                      )}
                      {profile.youtube && (
                        <a href={profile.youtube} target="_blank" rel="nofollow noreferrer"
                          className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors cursor-pointer">
                          <i className="ri-youtube-line"></i>
                        </a>
                      )}
                      {profile.twitter && (
                        <a href={`https://twitter.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="nofollow noreferrer"
                          className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer">
                          <i className="ri-twitter-x-line"></i>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Looking for */}
                  {fighter.looking_for && fighter.looking_for.includes('Patrocinio') && (
                    <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1.5">
                      <i className="ri-hand-coin-line text-yellow-400 text-xs"></i>
                      <span className="text-xs text-yellow-400 font-medium">Busca patrocinio</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-5 pb-4 flex gap-2">
                  <button onClick={() => navigate(`/fighter/${fighter.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-eye-line"></i> Ver perfil
                  </button>
                  <button onClick={() => setSelectedFighter({ fighter, profile, score })}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-hand-coin-line"></i> Contactar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-2">
          {filtered.map(({ fighter, profile, score }) => {
            const initials = (profile.full_name || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            const discColor = disciplineColors[fighter.discipline || ''] || disciplineColors.other;
            const followers = fakeFollowers(score);
            const hasSocial = profile.instagram || profile.youtube || profile.twitter;

            return (
              <div key={fighter.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-12 h-12 rounded-xl object-cover object-top flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{profile.full_name || 'Atleta'}</p>
                    {fighter.nickname && <span className="text-xs text-yellow-400 italic">&ldquo;{fighter.nickname}&rdquo;</span>}
                    {fighter.discipline && <span className={`text-xs px-2 py-0.5 rounded-full border ${discColor}`}>{disciplineLabels[fighter.discipline]}</span>}
                    {fighter.weight_class && <span className="text-xs text-zinc-500">{fighter.weight_class}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${fighter.is_available ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                      {fighter.is_available ? 'Disponible' : 'No disponible'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-green-400 font-bold">{fighter.wins}V</span>
                    <span className="text-xs text-red-400 font-bold">{fighter.losses}D</span>
                    <span className="text-xs text-orange-400 font-bold">{fighter.kos} KO</span>
                    <span className="text-xs text-yellow-400 flex items-center gap-1"><i className="ri-fire-line"></i>{followers}</span>
                    {hasSocial && (
                      <span className="flex items-center gap-1.5">
                        {profile.instagram && <i className="ri-instagram-line text-xs text-zinc-400"></i>}
                        {profile.youtube && <i className="ri-youtube-line text-xs text-zinc-400"></i>}
                        {profile.twitter && <i className="ri-twitter-x-line text-xs text-zinc-400"></i>}
                      </span>
                    )}
                    {(fighter.nationality || profile.location) && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <i className="ri-map-pin-line"></i>
                        {fighter.nationality || profile.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => navigate(`/fighter/${fighter.id}`)}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-eye-line"></i> Ver
                  </button>
                  <button onClick={() => setSelectedFighter({ fighter, profile, score })}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-hand-coin-line"></i> Contactar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contact modal */}
      {selectedFighter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Contactar atleta</h3>
              <button onClick={() => setSelectedFighter(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="flex items-center gap-3 mb-5 p-3 bg-zinc-800 rounded-xl">
              {selectedFighter.profile.avatar_url ? (
                <img src={selectedFighter.profile.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover object-top" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-sm font-black">
                  {(selectedFighter.profile.full_name || 'F')[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">{selectedFighter.profile.full_name}</p>
                {selectedFighter.fighter.discipline && (
                  <p className="text-xs text-zinc-400">{disciplineLabels[selectedFighter.fighter.discipline]}</p>
                )}
              </div>
            </div>
            <div className="space-y-3 mb-5">
              {selectedFighter.profile.instagram && (
                <a href={`https://instagram.com/${selectedFighter.profile.instagram.replace('@', '')}`} target="_blank" rel="nofollow noreferrer"
                  className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors cursor-pointer">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-orange-400 text-white">
                    <i className="ri-instagram-line text-sm"></i>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">Instagram</p>
                    <p className="text-xs text-zinc-400">{selectedFighter.profile.instagram}</p>
                  </div>
                  <i className="ri-external-link-line text-zinc-500 ml-auto"></i>
                </a>
              )}
              {selectedFighter.profile.youtube && (
                <a href={selectedFighter.profile.youtube} target="_blank" rel="nofollow noreferrer"
                  className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors cursor-pointer">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-600 text-white">
                    <i className="ri-youtube-line text-sm"></i>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">YouTube</p>
                    <p className="text-xs text-zinc-400 truncate max-w-[180px]">{selectedFighter.profile.youtube}</p>
                  </div>
                  <i className="ri-external-link-line text-zinc-500 ml-auto"></i>
                </a>
              )}
              {selectedFighter.profile.twitter && (
                <a href={`https://twitter.com/${selectedFighter.profile.twitter.replace('@', '')}`} target="_blank" rel="nofollow noreferrer"
                  className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors cursor-pointer">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-700 text-white">
                    <i className="ri-twitter-x-line text-sm"></i>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">Twitter / X</p>
                    <p className="text-xs text-zinc-400">{selectedFighter.profile.twitter}</p>
                  </div>
                  <i className="ri-external-link-line text-zinc-500 ml-auto"></i>
                </a>
              )}
              {!selectedFighter.profile.instagram && !selectedFighter.profile.youtube && !selectedFighter.profile.twitter && (
                <div className="text-center py-4 text-zinc-500 text-sm">
                  Este atleta no ha añadido redes sociales aún.
                </div>
              )}
            </div>
            <button onClick={() => { navigate(`/fighter/${selectedFighter.fighter.id}`); setSelectedFighter(null); }}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap text-sm">
              <i className="ri-external-link-line"></i>
              Ver perfil completo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

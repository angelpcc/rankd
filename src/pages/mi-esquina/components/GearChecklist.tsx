import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface GearItem {
  id: string;
  name: string;
  condition: 'good' | 'replace';
}

// Equipo esencial recomendado para deportes de contacto
const ESSENTIALS = [
  { name: 'Guantes', icon: 'ri-boxing-line' },
  { name: 'Vendas', icon: 'ri-hand-heart-line' },
  { name: 'Bucal', icon: 'ri-emotion-normal-line' },
  { name: 'Casco', icon: 'ri-shield-line' },
  { name: 'Espinilleras', icon: 'ri-footprint-line' },
  { name: 'Coquilla', icon: 'ri-shield-check-line' },
  { name: 'Comba', icon: 'ri-loop-left-line' },
  { name: 'Bolsa de deporte', icon: 'ri-briefcase-line' },
];

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST200' || msg.includes('does not exist') || msg.includes('could not find the table');
}

export default function GearChecklist({ profile, showToast }: Props) {
  const [items, setItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('gear_items')
      .select('id, name, condition')
      .eq('fighter_profile_id', profile.id)
      .order('created_at', { ascending: true });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setItems((data as GearItem[]) || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const byName = useMemo(() => {
    const m = new Map<string, GearItem>();
    items.forEach((it) => m.set(it.name.toLowerCase(), it));
    return m;
  }, [items]);

  const toggleOwned = async (name: string) => {
    if (busy) return;
    setBusy(true);
    const existing = byName.get(name.toLowerCase());
    if (existing) {
      const { error } = await supabase.from('gear_items').delete().eq('id', existing.id);
      if (error) showToast('No se pudo actualizar', 'error');
      else setItems((prev) => prev.filter((i) => i.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('gear_items')
        .insert({ fighter_profile_id: profile.id, name, condition: 'good' })
        .select('id, name, condition').maybeSingle();
      if (error || !data) showToast('No se pudo guardar', 'error');
      else setItems((prev) => [...prev, data as GearItem]);
    }
    setBusy(false);
  };

  const toggleCondition = async (item: GearItem) => {
    const next = item.condition === 'good' ? 'replace' : 'good';
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, condition: next } : i));
    const { error } = await supabase.from('gear_items').update({ condition: next }).eq('id', item.id);
    if (error) { showToast('No se pudo actualizar', 'error'); load(); }
  };

  const addCustom = async () => {
    const name = customName.trim();
    if (!name || busy) return;
    if (byName.has(name.toLowerCase())) { showToast('Ese material ya está en tu lista', 'error'); return; }
    setBusy(true);
    const { data, error } = await supabase.from('gear_items')
      .insert({ fighter_profile_id: profile.id, name, condition: 'good' })
      .select('id, name, condition').maybeSingle();
    if (error || !data) showToast('No se pudo añadir', 'error');
    else { setItems((prev) => [...prev, data as GearItem]); setCustomName(''); showToast('Material añadido'); }
    setBusy(false);
  };

  const removeItem = async (item: GearItem) => {
    const { error } = await supabase.from('gear_items').delete().eq('id', item.id);
    if (error) showToast('No se pudo eliminar', 'error');
    else setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const ownedEssentials = ESSENTIALS.filter((e) => byName.has(e.name.toLowerCase())).length;
  const pct = Math.round((ownedEssentials / ESSENTIALS.length) * 100);
  const customItems = items.filter((it) => !ESSENTIALS.some((e) => e.name.toLowerCase() === it.name.toLowerCase()));
  const toReplace = items.filter((it) => it.condition === 'replace');

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-boxing-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>INVENTARIO EN CAMINO</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Tu inventario de material estará disponible en cuanto se active en el servidor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="rk-eyebrow">TU ARSENAL</p>
        <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
          MI <span className="rk-red-glow">MATERIAL</span>
        </h2>
        <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Marca lo que ya tienes y controla el estado. El equipo gastado no protege igual.</p>
      </div>

      {/* Progreso */}
      <Reveal>
        <div className="rk-card" style={{ padding: '20px 22px' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="rk-h3" style={{ fontSize: '1rem', color: '#fff' }}>EQUIPO ESENCIAL</h3>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: pct === 100 ? '#4ade80' : '#fff' }}>{ownedEssentials}<span className="text-zinc-600">/{ESSENTIALS.length}</span></span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden mb-4">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#E10600,#ff4020)' }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {ESSENTIALS.map((e) => {
              const owned = byName.get(e.name.toLowerCase());
              return (
                <button key={e.name} onClick={() => toggleOwned(e.name)}
                  className={`relative flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-xl border transition-all cursor-pointer ${owned ? 'bg-red-600/12 border-red-500/30 text-white' : 'bg-white/[0.02] border-white/10 text-zinc-500 hover:border-white/25'}`}>
                  {owned && <i className="ri-checkbox-circle-fill absolute top-1.5 right-1.5 text-red-400 text-sm"></i>}
                  <i className={`${e.icon} text-xl ${owned ? 'text-red-400' : ''}`}></i>
                  <span className="text-[11px] font-semibold text-center leading-tight">{e.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Aviso de reemplazo */}
      {toReplace.length > 0 && (
        <Reveal>
          <div className="rk-card" style={{ padding: '16px 20px', borderColor: 'rgba(251,146,60,0.3)' }}>
            <div className="flex items-start gap-3">
              <i className="ri-alarm-warning-line text-orange-400 text-lg mt-0.5"></i>
              <div>
                <p className="text-sm font-bold text-orange-300">Toca renovar equipo</p>
                <p className="text-xs text-zinc-400 mt-0.5">Has marcado como gastado: {toReplace.map((i) => i.name).join(', ')}. El material en mal estado no protege igual.</p>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* Estado del equipo que tengo */}
      {items.length > 0 && (
        <Reveal delay={80}>
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Estado de mi equipo</h3>
            <div className="space-y-2">
              {[...ESSENTIALS.filter((e) => byName.has(e.name.toLowerCase())).map((e) => byName.get(e.name.toLowerCase())!), ...customItems].map((item) => (
                <div key={item.id} className="rk-card flex items-center gap-3 group" style={{ padding: '12px 16px' }}>
                  <div className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 border ${item.condition === 'replace' ? 'bg-orange-500/10 border-orange-500/25 text-orange-400' : 'bg-green-500/10 border-green-500/25 text-green-400'}`}>
                    <i className={item.condition === 'replace' ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'}></i>
                  </div>
                  <p className="text-sm font-semibold text-white flex-1 truncate">{item.name}</p>
                  <button onClick={() => toggleCondition(item)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer whitespace-nowrap ${item.condition === 'replace' ? 'bg-orange-500/12 border-orange-500/30 text-orange-400' : 'bg-white/[0.04] border-white/12 text-zinc-400 hover:text-white'}`}>
                    {item.condition === 'replace' ? 'Reemplazar' : 'En buen estado'}
                  </button>
                  <button onClick={() => removeItem(item)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <i className="ri-delete-bin-line text-sm"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* Añadir material propio */}
      <div className="flex gap-2">
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
          className="flex-1 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
          placeholder="Añadir otro material (ej: manoplas, saco...)" />
        <button onClick={addCustom} disabled={busy || !customName.trim()} className="rk-btn rk-btn-ghost flex items-center gap-1.5 disabled:opacity-50" style={{ fontSize: '0.8rem', padding: '0 1.2rem' }}>
          <i className="ri-add-line"></i>
        </button>
      </div>
    </div>
  );
}

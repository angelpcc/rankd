import { useState, useEffect, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Injury {
  id: string;
  body_part: string;
  title: string | null;
  severity: 'leve' | 'moderada' | 'grave';
  status: 'activa' | 'recuperando' | 'recuperada';
  started_on: string;
  resolved_on: string | null;
  notes: string | null;
  created_at: string;
}

const SEVERITY = {
  leve: { label: 'Leve', color: '#eab308', cls: 'bg-yellow-500/12 border-yellow-500/30 text-yellow-400' },
  moderada: { label: 'Moderada', color: '#fb923c', cls: 'bg-orange-500/12 border-orange-500/30 text-orange-400' },
  grave: { label: 'Grave', color: '#E10600', cls: 'bg-red-600/15 border-red-500/30 text-red-400' },
};

const STATUS = {
  activa: { label: 'Activa', icon: 'ri-alert-line', cls: 'bg-red-600/15 border-red-500/30 text-red-400' },
  recuperando: { label: 'Recuperando', icon: 'ri-heart-pulse-line', cls: 'bg-sky-500/12 border-sky-500/30 text-sky-400' },
  recuperada: { label: 'Recuperada', icon: 'ri-check-double-line', cls: 'bg-green-500/12 border-green-500/30 text-green-400' },
};

// Zonas frecuentes para acelerar el registro
const COMMON_PARTS = ['Hombro', 'Rodilla', 'Muñeca', 'Mano', 'Tobillo', 'Codo', 'Espalda', 'Costillas', 'Cuello', 'Cadera'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sinceLabel(start: string, end: string | null): string {
  const a = new Date(start + 'T12:00:00').getTime();
  const b = end ? new Date(end + 'T12:00:00').getTime() : Date.now();
  const days = Math.max(0, Math.round((b - a) / 86400000));
  if (days === 0) return 'hoy';
  if (days === 1) return '1 día';
  if (days < 21) return `${days} días`;
  if (days < 60) return `${Math.round(days / 7)} semanas`;
  return `${Math.round(days / 30)} meses`;
}

export default function InjuryTracker({ profile, showToast }: Props) {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bodyPart, setBodyPart] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Injury['severity']>('leve');
  const [startedOn, setStartedOn] = useState(todayISO());
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('injuries').select('*').eq('fighter_profile_id', profile.id).order('created_at', { ascending: false });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setInjuries((data || []) as Injury[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setBodyPart(''); setTitle(''); setSeverity('leve'); setStartedOn(todayISO()); setNotes(''); };

  const create = async () => {
    if (!bodyPart.trim()) { showToast('Indica la zona afectada', 'error'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('injuries').insert({
      fighter_profile_id: profile.id,
      body_part: bodyPart.trim(),
      title: title.trim() || null,
      severity,
      status: 'activa',
      started_on: startedOn,
      notes: notes.trim() || null,
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast('No se pudo guardar', 'error'); return; }
    setInjuries((prev) => [data as Injury, ...prev]);
    setShowForm(false);
    resetForm();
    showToast('Lesión registrada. La IA la tendrá en cuenta al planificar.');
  };

  const setStatus = async (inj: Injury, status: Injury['status']) => {
    const patch: Partial<Injury> = { status };
    patch.resolved_on = status === 'recuperada' ? todayISO() : null;
    const { error } = await supabase.from('injuries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', inj.id);
    if (error) { showToast('No se pudo actualizar', 'error'); return; }
    setInjuries((prev) => prev.map((x) => x.id === inj.id ? { ...x, ...patch } as Injury : x));
    showToast(status === 'recuperada' ? '¡Recuperado! A darlo todo 💪' : 'Estado actualizado');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('injuries').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar', 'error'); return; }
    setInjuries((prev) => prev.filter((x) => x.id !== id));
  };

  const openInjuries = injuries.filter((i) => i.status !== 'recuperada');
  const healed = injuries.filter((i) => i.status === 'recuperada');

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-first-aid-kit-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>SEGUIMIENTO DE LESIONES EN CAMINO</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          El seguimiento de lesiones estará disponible en cuanto se active en el servidor. Vuelve en un momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">ESCUCHA A TU CUERPO</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            LESIONES Y <span className="rk-red-glow">MOLESTIAS</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">Registra molestias y sigue su evolución. El Coach de Entrenamiento las tiene en cuenta para no cargar la zona.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rk-btn rk-btn-primary flex items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
          <i className="ri-add-line"></i> REGISTRAR
        </button>
      </div>

      {/* Aviso de integración con la IA */}
      {openInjuries.length > 0 && (
        <div className="flex items-start gap-3 rk-card" style={{ padding: '14px 16px', borderColor: 'rgba(56,189,248,0.25)' }}>
          <i className="ri-sparkling-2-line text-sky-400 mt-0.5 flex-shrink-0"></i>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Tienes <b className="text-white">{openInjuries.length}</b> {openInjuries.length === 1 ? 'lesión activa' : 'lesiones activas'}. Cuando pidas un plan al <b className="text-white">Coach de Entrenamiento</b>, adaptará la intensidad y evitará cargar {openInjuries.length === 1 ? 'la zona afectada' : 'las zonas afectadas'}.
          </p>
        </div>
      )}

      {injuries.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/25">
            <i className="ri-shield-check-line text-3xl text-green-400"></i>
          </div>
          <p className="text-white font-bold">Sin lesiones registradas</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Que siga así. Si notas una molestia, regístrala: llevar el seguimiento ayuda a recuperar antes y a entrenar con cabeza.
          </p>
        </div>
      ) : (
        <>
          {openInjuries.length > 0 && (
            <div className="space-y-3">
              {openInjuries.map((inj) => {
                const sev = SEVERITY[inj.severity];
                const st = STATUS[inj.status];
                return (
                  <div key={inj.id} className="rk-card group" style={{ padding: '18px 20px' }}>
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border" style={{ background: `${sev.color}14`, borderColor: `${sev.color}40`, color: sev.color }}>
                        <i className="ri-first-aid-kit-line text-xl"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-bold text-white">{inj.body_part}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${sev.cls}`}>{sev.label}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                        </div>
                        {inj.title && <p className="text-sm text-zinc-300 mt-1">{inj.title}</p>}
                        <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                          <i className="ri-time-line"></i>{sinceLabel(inj.started_on, null)} arrastrándola
                        </p>
                        {inj.notes && <p className="text-xs text-zinc-500 mt-2 leading-relaxed bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">{inj.notes}</p>}
                      </div>
                      <button onClick={() => remove(inj.id)} title="Eliminar"
                        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>

                    {/* Cambiar estado */}
                    <div className="flex gap-2 mt-3.5 flex-wrap">
                      {(['activa', 'recuperando', 'recuperada'] as const).map((s) => (
                        <button key={s} onClick={() => setStatus(inj, s)} disabled={inj.status === s}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:cursor-default ${inj.status === s ? STATUS[s].cls : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'}`}>
                          <i className={`${STATUS[s].icon} mr-1`}></i>{STATUS[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {healed.length > 0 && (
            <div>
              <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-3">Recuperadas</p>
              <div className="space-y-2">
                {healed.map((inj) => (
                  <div key={inj.id} className="rk-card flex items-center gap-3.5 group" style={{ padding: '12px 16px', opacity: 0.7 }}>
                    <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
                      <i className="ri-check-double-line"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{inj.body_part}{inj.title ? ` · ${inj.title}` : ''}</p>
                      <p className="text-xs text-zinc-600">Recuperada · duró {sinceLabel(inj.started_on, inj.resolved_on)}</p>
                    </div>
                    <button onClick={() => setStatus(inj, 'recuperando')} title="Reabrir" className="text-xs text-zinc-500 hover:text-white cursor-pointer px-2">Reabrir</button>
                    <button onClick={() => remove(inj.id)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-zinc-600 flex items-start gap-1.5 leading-relaxed">
        <i className="ri-information-line mt-0.5"></i>
        Esto es un registro personal, no un diagnóstico. Ante una lesión que no mejora o duele fuerte, acude a un fisioterapeuta o médico.
      </p>

      {/* Modal registrar */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>REGISTRAR LESIÓN</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Zona afectada</label>
                <input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} autoFocus maxLength={40}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                  placeholder="Ej: Hombro derecho" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COMMON_PARTS.map((p) => (
                    <button key={p} onClick={() => setBodyPart(p)}
                      className="text-[11px] text-zinc-400 bg-white/[0.03] border border-white/10 hover:border-white/25 hover:text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer">{p}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Qué te pasa (opcional)</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                  placeholder="Ej: Molestia al rotar, tendinitis..." />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-2 font-semibold uppercase tracking-wide">Gravedad</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['leve', 'moderada', 'grave'] as const).map((s) => (
                    <button key={s} onClick={() => setSeverity(s)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${severity === s ? SEVERITY[s].cls : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:border-white/20'}`}>
                      {SEVERITY[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Desde cuándo</label>
                <input type="date" value={startedOn} max={todayISO()} onChange={(e) => setStartedOn(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Notas (opcional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={400}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-y"
                  placeholder="Cómo pasó, qué la agrava, qué te ha dicho el fisio..." />
              </div>

              <button onClick={create} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> GUARDANDO...</> : <><i className="ri-first-aid-kit-line"></i> REGISTRAR</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

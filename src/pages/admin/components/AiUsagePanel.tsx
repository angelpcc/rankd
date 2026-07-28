import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  showToast: (msg: string, ok?: boolean) => void;
}

interface UsageRow {
  user_id: string;
  period: string;
  section: string;
  kind: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

interface Limits {
  monthly_messages: number;
  warn_at_pct: number;
  enabled: boolean;
}

const SECTION_LABEL: Record<string, string> = {
  training: 'Entrenamiento', nutrition: 'Nutrición', gear: 'Material',
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Consumo de IA y tope por usuario.
 *
 * Es la pantalla que permite activar la facturación de Anthropic sin miedo:
 * de un vistazo se ve cuánto se está gastando, quién consume más, y se puede
 * subir o bajar el tope sin tocar código.
 */
export default function AiUsagePanel({ showToast }: Props) {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);

  const [limitInput, setLimitInput] = useState('40');
  const [warnInput, setWarnInput] = useState('80');
  const [enabled, setEnabled] = useState(true);

  const period = currentPeriod();

  const load = useCallback(async () => {
    setLoading(true);
    const [settingsRes, usageRes, overrideRes] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'ai_limits').maybeSingle(),
      supabase.from('ai_usage').select('*').gte('period', period).order('created_at', { ascending: false }).limit(2000),
      supabase.from('ai_user_limits').select('user_id, monthly_messages'),
    ]);

    // Si la migración 0012 no está aplicada, se explica en vez de romper.
    if (settingsRes.error || usageRes.error) { setUnavailable(true); setLoading(false); return; }

    const l = (settingsRes.data?.value || {}) as Partial<Limits>;
    const parsed: Limits = {
      monthly_messages: l.monthly_messages ?? 40,
      warn_at_pct: l.warn_at_pct ?? 80,
      enabled: l.enabled !== false,
    };
    setLimits(parsed);
    setLimitInput(String(parsed.monthly_messages));
    setWarnInput(String(parsed.warn_at_pct));
    setEnabled(parsed.enabled);

    const usage = (usageRes.data || []) as UsageRow[];
    setRows(usage);
    setOverrides(new Map(((overrideRes.data || []) as { user_id: string; monthly_messages: number }[])
      .map((o) => [o.user_id, o.monthly_messages])));

    // Nombres de quienes han consumido, para que la tabla sea legible
    const ids = [...new Set(usage.map((u) => u.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      setNames(new Map(((profs || []) as { id: string; full_name: string | null }[])
        .map((p) => [p.id, p.full_name || '—'])));
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const saveLimits = async () => {
    setSaving(true);
    const value = {
      monthly_messages: Math.max(0, parseInt(limitInput, 10) || 0),
      warn_at_pct: Math.min(100, Math.max(1, parseInt(warnInput, 10) || 80)),
      enabled,
    };
    const { error } = await supabase.from('app_settings')
      .upsert({ key: 'ai_limits', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) { showToast('No se pudo guardar el tope', false); return; }
    setLimits(value);
    showToast('Tope de IA actualizado ✓');
  };

  const setUserOverride = async (userId: string, value: number | null) => {
    if (value === null) {
      const { error } = await supabase.from('ai_user_limits').delete().eq('user_id', userId);
      if (error) { showToast('No se pudo quitar la ampliación', false); return; }
      setOverrides((prev) => { const n = new Map(prev); n.delete(userId); return n; });
      showToast('Ampliación retirada');
      return;
    }
    const { error } = await supabase.from('ai_user_limits')
      .upsert({ user_id: userId, monthly_messages: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) { showToast('No se pudo ampliar la cuota', false); return; }
    setOverrides((prev) => new Map(prev).set(userId, value));
    showToast(`Cuota ampliada a ${value} consultas`);
  };

  // ── Agregados ──
  const stats = useMemo(() => {
    const thisMonth = rows.filter((r) => r.period === period);
    const chats = thisMonth.filter((r) => r.kind === 'chat');
    const cost = thisMonth.reduce((a, r) => a + Number(r.cost_usd || 0), 0);
    const inTok = thisMonth.reduce((a, r) => a + (r.input_tokens || 0), 0);
    const outTok = thisMonth.reduce((a, r) => a + (r.output_tokens || 0), 0);

    const byUser = new Map<string, { msgs: number; cost: number }>();
    thisMonth.forEach((r) => {
      const cur = byUser.get(r.user_id) || { msgs: 0, cost: 0 };
      if (r.kind === 'chat') cur.msgs += 1;
      cur.cost += Number(r.cost_usd || 0);
      byUser.set(r.user_id, cur);
    });

    const bySection = new Map<string, number>();
    chats.forEach((r) => bySection.set(r.section, (bySection.get(r.section) || 0) + 1));

    return {
      messages: chats.length,
      cost,
      inTok,
      outTok,
      users: byUser.size,
      top: [...byUser.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 12),
      bySection: [...bySection.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [rows, period]);

  // Techo de gasto del mes si TODOS los usuarios activos agotaran su cuota.
  const worstCase = useMemo(() => {
    if (!limits || stats.messages === 0) return null;
    const avgPerMsg = stats.cost / stats.messages;
    return avgPerMsg * limits.monthly_messages * Math.max(stats.users, 1);
  }, [limits, stats]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '44px 26px', transform: 'none' }}>
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
          <i className="ri-shield-keyhole-line text-3xl text-yellow-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>CONTROL DE GASTO SIN ACTIVAR</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          Ejecuta la migración <code className="text-yellow-300 font-mono text-xs">0012_ai_limits.sql</code> en Supabase.
          Hasta entonces la IA no responde a nadie: es a propósito, para que no haya consumo sin contabilizar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
          CONSUMO DE <span className="rk-red-glow">IA</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-2">Gasto del mes en curso y tope por usuario. Ajústalo sin tocar código.</p>
      </div>

      {/* Cifras del mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Consultas este mes', v: String(stats.messages), c: '#E10600', i: 'ri-chat-3-line' },
          { l: 'Coste acumulado', v: `$${stats.cost.toFixed(2)}`, c: '#4ade80', i: 'ri-money-dollar-circle-line' },
          { l: 'Usuarios con uso', v: String(stats.users), c: '#38bdf8', i: 'ri-group-line' },
          { l: 'Tokens (ent./sal.)', v: `${Math.round(stats.inTok / 1000)}k/${Math.round(stats.outTok / 1000)}k`, c: '#C9A84C', i: 'ri-database-2-line' },
        ].map((s) => (
          <div key={s.l} className="rk-card" style={{ padding: '16px 18px' }}>
            <i className={s.i} style={{ color: s.c }}></i>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1, color: s.c, marginTop: 8 }}>{s.v}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1 leading-tight">{s.l}</p>
          </div>
        ))}
      </div>

      {worstCase !== null && (
        <p className="text-[11px] text-zinc-500 -mt-3 flex items-start gap-1.5">
          <i className="ri-information-line mt-0.5"></i>
          Con el tope actual y el coste medio por consulta, el techo de gasto de estos {stats.users} usuarios sería de
          <b className="text-zinc-300"> ${worstCase.toFixed(2)}</b> al mes si todos agotaran su cuota.
        </p>
      )}

      {/* Configuración del tope */}
      <div className="rk-card" style={{ padding: '20px', transform: 'none' }}>
        <h2 className="rk-h3 mb-1" style={{ fontSize: '1rem', color: '#fff' }}>TOPE POR USUARIO</h2>
        <p className="text-xs text-zinc-500 mb-4">Consultas al mes que puede hacer cada usuario. Se reinicia el día 1.</p>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Consultas/mes</label>
            <input value={limitInput} onChange={(e) => setLimitInput(e.target.value)} inputMode="numeric"
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Avisar al (%)</label>
            <input value={warnInput} onChange={(e) => setWarnInput(e.target.value)} inputMode="numeric"
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Límite activo</label>
            <button onClick={() => setEnabled((v) => !v)}
              className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border transition-colors cursor-pointer ${enabled ? 'bg-green-500/12 border-green-500/35 text-green-400' : 'bg-red-600/12 border-red-500/35 text-red-400'}`}>
              <i className={enabled ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'}></i>
              {enabled ? 'Sí' : 'No'}
            </button>
          </div>
        </div>

        {!enabled && (
          <p className="text-[11px] text-red-400 mt-3 flex items-start gap-1.5">
            <i className="ri-alert-line mt-0.5"></i>
            Con el límite desactivado no hay tope de consultas por usuario. El consumo se sigue registrando, pero nada lo frena.
          </p>
        )}

        <button onClick={saveLimits} disabled={saving}
          className="rk-btn rk-btn-primary mt-4 w-full sm:w-auto disabled:opacity-60" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
          {saving ? 'GUARDANDO...' : 'GUARDAR TOPE'}
        </button>
      </div>

      {/* Reparto por asistente */}
      {stats.bySection.length > 0 && (
        <div className="rk-card" style={{ padding: '20px', transform: 'none' }}>
          <h2 className="rk-h3 mb-4" style={{ fontSize: '1rem', color: '#fff' }}>POR ASISTENTE</h2>
          <div className="space-y-3">
            {stats.bySection.map(([sec, n]) => {
              const pct = stats.messages > 0 ? Math.round((n / stats.messages) * 100) : 0;
              return (
                <div key={sec}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-zinc-300">{SECTION_LABEL[sec] || sec}</span>
                    <span className="text-xs text-zinc-500"><span className="text-white font-bold">{n}</span> · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#E10600' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quién consume más */}
      <div>
        <h2 className="rk-h3 mb-3" style={{ fontSize: '1rem', color: '#fff' }}>QUIÉN CONSUME MÁS</h2>
        {stats.top.length === 0 ? (
          <div className="rk-card text-center" style={{ padding: '32px 20px', transform: 'none' }}>
            <i className="ri-sparkling-2-line text-3xl text-zinc-700"></i>
            <p className="text-sm text-zinc-400 mt-3">Todavía no hay consumo de IA este mes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.top.map(([userId, u]) => {
              const override = overrides.get(userId);
              const effective = override ?? limits?.monthly_messages ?? 40;
              const pct = effective > 0 ? Math.min(100, Math.round((u.msgs / effective) * 100)) : 0;
              return (
                <div key={userId} className="rk-card" style={{ padding: '14px 16px', transform: 'none' }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">{names.get(userId) || userId.slice(0, 8)}</p>
                        {override !== undefined && (
                          <span className="text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/12 border border-[#C9A84C]/30 px-2 py-0.5 rounded-full">
                            Ampliada a {override}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {u.msgs} / {effective} consultas · <span className="text-green-400">${u.cost.toFixed(2)}</span>
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => setUserOverride(userId, effective + 25)}
                        className="text-xs font-bold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                        +25
                      </button>
                      {override !== undefined && (
                        <button onClick={() => setUserOverride(userId, null)}
                          className="text-xs font-bold text-zinc-500 hover:text-red-400 px-2 py-1.5 rounded-lg cursor-pointer transition-colors">
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden mt-2.5">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#E10600' : pct >= 80 ? '#fb923c' : '#4ade80' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5 flex-shrink-0"></i>
        El coste es una estimación con la tarifa del modelo ({`$${5}/M entrada, $${25}/M salida`}) sobre los tokens que devuelve la API en cada llamada. La factura real de Anthropic manda.
      </p>
    </div>
  );
}

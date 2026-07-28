import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Retention {
  total_users: number;
  active_7d: number;
  active_30d: number;
  active_15m: number;
  returning_users: number;
  one_and_done: number;
  avg_days_between: number | null;
  avg_visit_days: number | null;
}

interface ProfileRow { user_type: string; created_at: string }

const TYPE_LABEL: Record<string, string> = {
  fighter: 'Peleadores', promoter: 'Promotoras', manager: 'Managers', brand: 'Marcas', gym: 'Gimnasios',
};
const TYPE_COLOR: Record<string, string> = {
  fighter: '#E10600', promoter: '#fb923c', manager: '#38bdf8', brand: '#C9A84C', gym: '#34d399',
};

/** Secciones de Mi Esquina cuyo uso real queremos medir. */
const FEATURES = [
  { table: 'training_sessions', col: 'fighter_profile_id', label: 'Diario de entrenos', icon: 'ri-calendar-check-line' },
  { table: 'daily_checkins', col: 'fighter_profile_id', label: 'Check-in diario', icon: 'ri-heart-pulse-line' },
  { table: 'weight_entries', col: 'fighter_profile_id', label: 'Control de peso', icon: 'ri-scales-2-line' },
  { table: 'meal_entries', col: 'fighter_profile_id', label: 'Diario de comidas', icon: 'ri-restaurant-line' },
  { table: 'planned_events', col: 'fighter_profile_id', label: 'Calendario', icon: 'ri-calendar-2-line' },
  { table: 'workout_templates', col: 'fighter_profile_id', label: 'Rutinas guardadas', icon: 'ri-repeat-line' },
  { table: 'fighter_goals', col: 'fighter_profile_id', label: 'Objetivos', icon: 'ri-flag-line' },
  { table: 'sparring_sessions', col: 'fighter_profile_id', label: 'Sparring', icon: 'ri-boxing-line' },
  { table: 'technique_notes', col: 'fighter_profile_id', label: 'Notas técnicas', icon: 'ri-book-open-line' },
];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Métricas de la plataforma, con la recurrencia como protagonista.
 *
 * El número de altas engaña: lo que dice si el producto funciona es cuánta
 * gente vuelve. Por eso el bloque de recurrencia va primero y separa de forma
 * explícita "se registraron y no volvieron" de "lo usan de verdad".
 */
export default function MetricsPanel() {
  const [retention, setRetention] = useState<Retention | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [features, setFeatures] = useState<{ label: string; icon: string; users: number; rows: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [range, setRange] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);

    const [retRes, profRes] = await Promise.all([
      supabase.rpc('rk_retention'),
      supabase.from('profiles').select('user_type, created_at').order('created_at', { ascending: true }),
    ]);

    if (retRes.error) { setUnavailable(true); setLoading(false); return; }
    const r = Array.isArray(retRes.data) ? retRes.data[0] : retRes.data;
    setRetention(r as Retention);
    setProfiles((profRes.data || []) as ProfileRow[]);

    // Uso real por sección: usuarios distintos que han guardado algo.
    // Cada tabla va por su cuenta; si alguna no existe aún, se ignora.
    const results = await Promise.all(FEATURES.map(async (f) => {
      const { data, error } = await supabase.from(f.table).select(f.col).limit(5000);
      if (error) return null;
      const rows = (data || []) as unknown as Record<string, string>[];
      return {
        label: f.label, icon: f.icon,
        users: new Set(rows.map((x) => x[f.col])).size,
        rows: rows.length,
      };
    }));
    setFeatures(results.filter(Boolean) as { label: string; icon: string; users: number; rows: number }[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Altas por periodo ──
  const signups = useMemo(() => {
    const today = iso(new Date());
    const weekAgo = iso(new Date(Date.now() - 7 * 86400000));
    const monthAgo = iso(new Date(Date.now() - 30 * 86400000));
    const count = (since: string) => profiles.filter((p) => p.created_at.slice(0, 10) >= since);
    const byType = (rows: ProfileRow[]) => {
      const m: Record<string, number> = {};
      rows.forEach((p) => { m[p.user_type] = (m[p.user_type] || 0) + 1; });
      return m;
    };
    return {
      today: { n: count(today).length, types: byType(count(today)) },
      week: { n: count(weekAgo).length, types: byType(count(weekAgo)) },
      month: { n: count(monthAgo).length, types: byType(count(monthAgo)) },
    };
  }, [profiles]);

  // ── Evolución acumulada de altas ──
  const chart = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - range);
    const days: { date: string; label: string; nuevas: number; total: number }[] = [];
    let running = profiles.filter((p) => new Date(p.created_at) < since).length;
    for (let i = range; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = iso(d);
      const n = profiles.filter((p) => p.created_at.slice(0, 10) === key).length;
      running += n;
      days.push({
        date: key,
        label: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        nuevas: n,
        total: running,
      });
    }
    return days;
  }, [profiles, range]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '44px 26px', transform: 'none' }}>
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
          <i className="ri-line-chart-line text-3xl text-yellow-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>MÉTRICAS SIN ACTIVAR</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
          Ejecuta la migración <code className="text-yellow-300 font-mono text-xs">0013_usage_metrics.sql</code> en Supabase.
          A partir de ese momento se empieza a registrar qué días entra cada usuario.
        </p>
      </div>
    );
  }

  const total = retention?.total_users || 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const withVisits = (retention?.returning_users || 0) + (retention?.one_and_done || 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
          MÉTRICAS DE <span className="rk-red-glow">USO</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-2">Lo importante no es cuánta gente se registra, sino cuánta vuelve.</p>
      </div>

      {/* ══ RECURRENCIA — lo primero, por importancia ══ */}
      <div className="rk-card" style={{ padding: '20px', transform: 'none', borderColor: 'rgba(225,6,0,0.28)' }}>
        <div className="flex items-center gap-2 mb-4">
          <i className="ri-loop-right-line text-[#E10600]"></i>
          <h2 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff' }}>RECURRENCIA</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: 'Vuelven (7 días)', v: retention?.active_7d ?? 0, sub: `${pct(retention?.active_7d ?? 0)}% del total`, c: '#4ade80' },
            { l: 'Vuelven (30 días)', v: retention?.active_30d ?? 0, sub: `${pct(retention?.active_30d ?? 0)}% del total`, c: '#38bdf8' },
            { l: 'Han vuelto alguna vez', v: retention?.returning_users ?? 0, sub: `${pct(retention?.returning_users ?? 0)}% del total`, c: '#C9A84C' },
            { l: 'Entraron solo 1 día', v: retention?.one_and_done ?? 0, sub: `${pct(retention?.one_and_done ?? 0)}% del total`, c: '#fb923c' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 1, color: s.c }}>{s.v}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 leading-tight">{s.l}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Barra: se quedaron vs vuelven */}
        {withVisits > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-green-400 font-semibold">Lo usan de verdad · {retention?.returning_users}</span>
              <span className="text-orange-400 font-semibold">{retention?.one_and_done} · No volvieron</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden flex">
              <div style={{ width: `${Math.round(((retention?.returning_users || 0) / withVisits) * 100)}%`, background: '#4ade80' }} />
              <div style={{ flex: 1, background: '#fb923c' }} />
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/[0.06]">
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Días entre visita y visita</p>
            <p className="text-lg font-bold text-white mt-0.5">
              {retention?.avg_days_between != null ? `${retention.avg_days_between} días` : '—'}
            </p>
            <p className="text-[10px] text-zinc-600">Media de quien ha vuelto al menos una vez</p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Días de uso por usuario</p>
            <p className="text-lg font-bold text-white mt-0.5">
              {retention?.avg_visit_days != null ? `${retention.avg_visit_days} días` : '—'}
            </p>
            <p className="text-[10px] text-zinc-600">Media de días distintos que ha entrado</p>
          </div>
        </div>
      </div>

      {/* ══ ACTIVOS AHORA — con su limitación explicada ══ */}
      <div className="rk-card flex items-start gap-4" style={{ padding: '18px 20px', transform: 'none' }}>
        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-green-500/12 border border-green-500/30">
          <span className="relative flex items-center justify-center">
            <span className="absolute w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-60"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1, color: '#4ade80' }}>
              {retention?.active_15m ?? 0}
            </span>
            <span className="text-sm text-zinc-300 font-semibold">activos hace menos de 15 min</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
            <b className="text-zinc-400">Qué cuenta exactamente:</b> usuarios que han <b className="text-zinc-400">cargado la plataforma</b> en los últimos 15 minutos.
            No es "conectados ahora mismo": si alguien deja la pestaña abierta sin recargar, deja de contarse; y si entró hace 14 minutos y ya se fue, sigue contándose.
            Un dato de verdad en tiempo real exigiría mantener una conexión permanente abierta con cada usuario, que encarece y complica sin aportar mucho a esta escala.
            Este número es honesto para lo que es: <b className="text-zinc-400">actividad muy reciente</b>.
          </p>
        </div>
      </div>

      {/* ══ ALTAS ══ */}
      <div>
        <h2 className="rk-h3 mb-3" style={{ fontSize: '1.05rem', color: '#fff' }}>ALTAS</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { l: 'Hoy', d: signups.today },
            { l: 'Últimos 7 días', d: signups.week },
            { l: 'Últimos 30 días', d: signups.month },
          ].map((p) => (
            <div key={p.l} className="rk-card" style={{ padding: '16px 18px' }}>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{p.l}</p>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, lineHeight: 1, color: '#fff', marginTop: 4 }}>{p.d.n}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(p.d.types).length === 0 ? (
                  <span className="text-[10px] text-zinc-600">Sin altas</span>
                ) : Object.entries(p.d.types).map(([tp, n]) => (
                  <span key={tp} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${TYPE_COLOR[tp] || '#666'}18`, color: TYPE_COLOR[tp] || '#999' }}>
                    {TYPE_LABEL[tp] || tp}: {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ EVOLUCIÓN ══ */}
      <div className="rk-card" style={{ padding: '20px', transform: 'none' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="rk-h3" style={{ fontSize: '1.05rem', color: '#fff' }}>EVOLUCIÓN DE ALTAS</h2>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setRange(d)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${range === d ? 'bg-red-600 text-white' : 'bg-white/[0.04] text-zinc-400 hover:text-white'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="sgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E10600" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#E10600" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} width={36} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }} />
              <Area type="monotone" dataKey="total" name="Usuarios totales" stroke="#E10600" strokeWidth={2.5} fill="url(#sgrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ══ USO POR SECCIÓN ══ */}
      <div>
        <h2 className="rk-h3 mb-1" style={{ fontSize: '1.05rem', color: '#fff' }}>QUÉ SE USA DE MI ESQUINA</h2>
        <p className="text-xs text-zinc-500 mb-3">Usuarios distintos que han guardado algo en cada sección. Lo que sale a cero, se ignora.</p>
        <div className="space-y-2">
          {[...features].sort((a, b) => b.users - a.users).map((f) => {
            const max = Math.max(...features.map((x) => x.users), 1);
            const w = Math.round((f.users / max) * 100);
            return (
              <div key={f.label} className="rk-card flex items-center gap-3.5" style={{ padding: '12px 16px', transform: 'none' }}>
                <i className={f.icon} style={{ color: f.users > 0 ? '#E10600' : '#52525b', fontSize: 17 }}></i>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-white truncate">{f.label}</span>
                    <span className="text-xs text-zinc-500 flex-shrink-0">
                      <span className="text-white font-bold">{f.users}</span> {f.users === 1 ? 'usuario' : 'usuarios'}
                      <span className="text-zinc-600"> · {f.rows} registros</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${w}%`, background: f.users > 0 ? '#E10600' : 'transparent' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5 flex-shrink-0"></i>
        La recurrencia solo cuenta desde que se aplicó la migración 0013: los usuarios que entraron antes no tienen visitas registradas
        y aparecerán como "sin volver" hasta que entren de nuevo.
      </p>
    </div>
  );
}

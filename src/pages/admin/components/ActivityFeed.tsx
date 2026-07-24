import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Entry {
  id: string;
  at: string;
  icon: string;
  color: string;
  title: string;
  detail: string;
  group: 'altas' | 'contenido' | 'dinero' | 'contacto';
}

const GROUPS = [
  { id: 'all', label: 'Todo', icon: 'ri-pulse-line' },
  { id: 'altas', label: 'Altas', icon: 'ri-user-add-line' },
  { id: 'contenido', label: 'Contenido', icon: 'ri-megaphone-line' },
  { id: 'dinero', label: 'Entradas', icon: 'ri-ticket-2-line' },
  { id: 'contacto', label: 'Contacto', icon: 'ri-mail-line' },
] as const;

const TYPE_ICON: Record<string, { icon: string; color: string; label: string }> = {
  fighter: { icon: 'ri-boxing-line', color: '#E10600', label: 'Peleador' },
  promoter: { icon: 'ri-trophy-line', color: '#fb923c', label: 'Promotora' },
  gym: { icon: 'ri-building-4-line', color: '#34d399', label: 'Gimnasio' },
  manager: { icon: 'ri-user-star-line', color: '#38bdf8', label: 'Manager' },
  brand: { icon: 'ri-store-2-line', color: '#C9A84C', label: 'Marca' },
};

function ago(dateStr: string): string {
  const t = new Date(dateStr).getTime();
  if (!t) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Agrupa por día para que la línea de tiempo se lea de un vistazo. */
function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return `Hace ${diff} días`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

export default function ActivityFeed() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const LIMIT = 25;

    // Cada consulta va por su cuenta: si una tabla no existe todavía,
    // el resto del panel sigue funcionando.
    const [profiles, opps, events, brands, orders, inquiries, contacts, apps] = await Promise.all([
      supabase.from('profiles').select('id, full_name, user_type, location, created_at').order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('opportunities').select('id, title, type, location, created_at').order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('organization_events').select('id, title, location, event_date, created_at').order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('brands').select('id, name, category, status, created_at').order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('ticket_orders').select('id, buyer_name, quantity, total_cents, created_at').order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('fighter_inquiries').select('id, contact_name, fighter_name, interest_type, created_at').order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('contact_submissions').select('id, name, role, created_at').order('created_at', { ascending: false }).limit(LIMIT),
      supabase.from('applications').select('id, status, created_at').order('created_at', { ascending: false }).limit(LIMIT),
    ]);

    const out: Entry[] = [];

    (profiles.data || []).forEach((p) => {
      const cfg = TYPE_ICON[p.user_type] || TYPE_ICON.fighter;
      out.push({
        id: `p-${p.id}`, at: p.created_at, icon: cfg.icon, color: cfg.color, group: 'altas',
        title: `Alta de ${cfg.label.toLowerCase()}`,
        detail: [p.full_name || 'Sin nombre', p.location].filter(Boolean).join(' · '),
      });
    });

    (opps.data || []).forEach((o) => out.push({
      id: `o-${o.id}`, at: o.created_at, icon: 'ri-megaphone-line', color: '#fb923c', group: 'contenido',
      title: 'Nueva oportunidad', detail: [o.title, o.type, o.location].filter(Boolean).join(' · '),
    }));

    (events.data || []).forEach((e) => out.push({
      id: `e-${e.id}`, at: e.created_at, icon: 'ri-calendar-event-line', color: '#a78bfa', group: 'contenido',
      title: 'Nuevo evento', detail: [e.title, e.location].filter(Boolean).join(' · '),
    }));

    (brands.data || []).forEach((b) => out.push({
      id: `b-${b.id}`, at: b.created_at, icon: 'ri-store-2-line', color: '#C9A84C', group: 'contenido',
      title: b.status === 'pending' ? 'Marca pendiente de aprobar' : 'Nueva marca',
      detail: [b.name, b.category].filter(Boolean).join(' · '),
    }));

    (orders.data || []).forEach((t) => out.push({
      id: `t-${t.id}`, at: t.created_at, icon: 'ri-ticket-2-line', color: '#22c55e', group: 'dinero',
      title: 'Entrada reservada',
      detail: `${t.buyer_name || 'Comprador'} · ${t.quantity} ud. · ${((t.total_cents || 0) / 100).toFixed(2)} €`,
    }));

    (inquiries.data || []).forEach((q) => out.push({
      id: `q-${q.id}`, at: q.created_at, icon: 'ri-user-received-line', color: '#38bdf8', group: 'contacto',
      title: 'Contacto a un peleador',
      detail: [q.contact_name, q.fighter_name && `→ ${q.fighter_name}`, q.interest_type].filter(Boolean).join(' · '),
    }));

    (contacts.data || []).forEach((c) => out.push({
      id: `c-${c.id}`, at: c.created_at, icon: 'ri-mail-line', color: '#e879f9', group: 'contacto',
      title: 'Mensaje desde el formulario',
      detail: [c.name, c.role].filter(Boolean).join(' · '),
    }));

    (apps.data || []).forEach((a) => out.push({
      id: `a-${a.id}`, at: a.created_at, icon: 'ri-file-list-3-line', color: '#94a3b8', group: 'contenido',
      title: 'Candidatura enviada',
      detail: a.status === 'accepted' ? 'Aceptada' : a.status === 'rejected' ? 'Rechazada' : 'Pendiente de revisar',
    }));

    out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setEntries(out.slice(0, 80));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.group === filter);

  // Resumen de las últimas 24 h: lo que de verdad quieres ver al abrir el panel.
  const last24 = entries.filter((e) => Date.now() - new Date(e.at).getTime() < 86400000);
  const counts = {
    altas: last24.filter((e) => e.group === 'altas').length,
    contenido: last24.filter((e) => e.group === 'contenido').length,
    dinero: last24.filter((e) => e.group === 'dinero').length,
    contacto: last24.filter((e) => e.group === 'contacto').length,
  };

  let lastDay = '';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(30px,5vw,44px)', letterSpacing: 1, lineHeight: 1 }}>
            ACTIVIDAD <span className="rk-red-glow">RECIENTE</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2">Todo lo que ha pasado en la plataforma, en una sola línea de tiempo.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 px-4 py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-50">
          <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i> Actualizar
        </button>
      </div>

      {/* Últimas 24 h */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Altas nuevas', v: counts.altas, c: '#E10600', i: 'ri-user-add-line' },
          { l: 'Contenido publicado', v: counts.contenido, c: '#fb923c', i: 'ri-megaphone-line' },
          { l: 'Entradas reservadas', v: counts.dinero, c: '#22c55e', i: 'ri-ticket-2-line' },
          { l: 'Contactos recibidos', v: counts.contacto, c: '#38bdf8', i: 'ri-mail-line' },
        ].map((s) => (
          <div key={s.l} className="rk-card p-4" style={{ transform: 'none' }}>
            <i className={s.i} style={{ color: s.c }}></i>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 1, color: s.c, marginTop: 8 }}>{s.v}</p>
            <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider leading-tight">{s.l}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-600 -mt-3">Cifras de las últimas 24 horas.</p>

      {/* Filtros */}
      <div className="flex gap-1.5 overflow-x-auto">
        {GROUPS.map((g) => (
          <button key={g.id} onClick={() => setFilter(g.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              filter === g.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/25'
            }`}>
            <i className={g.icon}></i>{g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rk-card" style={{ transform: 'none' }}>
          <i className="ri-pulse-line text-4xl text-zinc-700"></i>
          <p className="text-zinc-400 text-sm mt-3 font-medium">Sin actividad registrada</p>
          <p className="text-zinc-600 text-xs mt-1">Cuando alguien se registre o publique algo, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Raíl vertical de la línea de tiempo */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/[0.08]" />
          {filtered.map((e) => {
            const label = dayLabel(e.at);
            const showDay = label !== lastDay;
            lastDay = label;
            return (
              <div key={e.id}>
                {showDay && (
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-zinc-600 mt-6 mb-3 first:mt-0">{label}</p>
                )}
                <div className="relative flex items-start gap-3.5 py-2.5">
                  <span className="absolute -left-6 top-3 w-[23px] h-[23px] flex items-center justify-center rounded-full border"
                    style={{ background: '#0a0a0a', borderColor: `${e.color}55`, color: e.color }}>
                    <i className={`${e.icon} text-[11px]`}></i>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-snug">{e.title}</p>
                    {e.detail && <p className="text-xs text-zinc-500 mt-0.5 truncate">{e.detail}</p>}
                  </div>
                  <span className="text-[11px] text-zinc-600 whitespace-nowrap flex-shrink-0 pt-0.5">{ago(e.at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

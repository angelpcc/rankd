import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type NotificationKind =
  | 'training_reminder' | 'inactivity' | 'message' | 'application'
  | 'application_accepted' | 'verification' | 'ticket_sold' | 'broadcast' | 'system';

export interface AppNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Icono y color por tipo de aviso. Se usa en la campana y en el listado. */
export const NOTIF_STYLE: Record<string, { icon: string; color: string }> = {
  training_reminder: { icon: 'ri-calendar-check-line', color: '#E10600' },
  inactivity: { icon: 'ri-fire-line', color: '#fb923c' },
  message: { icon: 'ri-message-3-line', color: '#38bdf8' },
  application: { icon: 'ri-file-list-3-line', color: '#C9A84C' },
  application_accepted: { icon: 'ri-checkbox-circle-line', color: '#22c55e' },
  verification: { icon: 'ri-shield-check-line', color: '#22c55e' },
  ticket_sold: { icon: 'ri-ticket-2-line', color: '#a78bfa' },
  broadcast: { icon: 'ri-megaphone-line', color: '#E10600' },
  system: { icon: 'ri-notification-3-line', color: '#a1a1aa' },
};

export function notifStyle(kind: string) {
  return NOTIF_STYLE[kind] || NOTIF_STYLE.system;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/**
 * Avisos internos del usuario: carga, contador de no leídos, marcado y
 * generación de recordatorios de entreno.
 *
 * Los avisos entre usuarios (mensajes, candidaturas, verificación) los crea la
 * base de datos con disparadores. Aquí solo se generan los que el usuario se
 * crea a sí mismo, que es lo único que permite RLS desde el navegador.
 */
export function useNotifications(userId: string | undefined, opts?: { reminders?: boolean }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  // Si la migración 0008 aún no se ha aplicado, no insistimos en cada render.
  const [available, setAvailable] = useState(true);
  const remindersDone = useRef(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) { setAvailable(false); setLoading(false); return; }
    setItems((data || []) as AppNotification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: los avisos que crea un disparador aparecen sin recargar.
  useEffect(() => {
    if (!userId || !available) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, available]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
  }, [userId]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  }, []);

  // ── Recordatorios de entreno ──
  // Se generan al abrir Mi Esquina. Dos casos:
  //   1. Hay entrenos planificados para hoy que siguen sin marcar.
  //   2. Lleva días sin registrar nada en el diario.
  // Se comprueba antes que no exista ya el mismo aviso hoy, para no duplicar.
  const buildReminders = useCallback(async () => {
    if (!userId || !available || remindersDone.current) return;
    remindersDone.current = true;

    const todayStart = startOfToday().toISOString();
    const { data: todaysNotifs } = await supabase
      .from('notifications')
      .select('kind')
      .eq('user_id', userId)
      .gte('created_at', todayStart);
    const already = new Set((todaysNotifs || []).map((n) => n.kind));

    const pending: { kind: NotificationKind; title: string; body: string; link: string }[] = [];

    // 1. Entreno planificado para hoy
    if (!already.has('training_reminder')) {
      const { data: plan } = await supabase
        .from('weekly_plans').select('plan').eq('fighter_profile_id', userId).maybeSingle();
      const jsDay = new Date().getDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
      const todays = ((plan?.plan as { day: number; title: string; time: string; done: boolean; kind: string }[]) || [])
        .filter((it) => it.day === dayIdx && !it.done && it.kind !== 'descanso');
      if (todays.length > 0) {
        const first = [...todays].sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0];
        pending.push({
          kind: 'training_reminder',
          title: todays.length === 1 ? 'Tienes entreno hoy' : `Tienes ${todays.length} entrenos hoy`,
          body: `${first.time ? first.time + ' · ' : ''}${first.title}${todays.length > 1 ? ` y ${todays.length - 1} más` : ''}`,
          link: '/mi-esquina',
        });
      }
    }

    // 2. Días sin registrar actividad
    if (!already.has('inactivity')) {
      const { data: sessions } = await supabase
        .from('training_sessions').select('session_date')
        .eq('fighter_profile_id', userId)
        .order('session_date', { ascending: false }).limit(1);
      const last = sessions?.[0]?.session_date;
      if (last) {
        const days = Math.floor((Date.now() - new Date(last + 'T12:00:00').getTime()) / 86400000);
        if (days >= 3) {
          pending.push({
            kind: 'inactivity',
            title: `Llevas ${days} días sin registrar entreno`,
            body: 'La forma se pierde antes de lo que parece. Vuelve al diario y retoma la racha.',
            link: '/mi-esquina',
          });
        }
      }
    }

    if (pending.length === 0) return;
    const { data: inserted } = await supabase
      .from('notifications')
      .insert(pending.map((p) => ({ ...p, user_id: userId })))
      .select();
    if (inserted?.length) setItems((prev) => [...(inserted as AppNotification[]), ...prev]);
  }, [userId, available]);

  useEffect(() => {
    if (opts?.reminders && !loading) buildReminders();
  }, [opts?.reminders, loading, buildReminders]);

  const unread = items.filter((n) => !n.read_at).length;

  return { items, unread, loading, available, load, markRead, markAllRead, remove };
}

/** "hace 5 min", "hace 2 h", "hace 3 d" o la fecha si es más antiguo. */
export function notifTimeAgo(dateStr: string): string {
  const t = new Date(dateStr).getTime();
  if (!t) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export { iso as isoDate };

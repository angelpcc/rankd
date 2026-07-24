import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, notifStyle, notifTimeAgo } from '@/hooks/useNotifications';

interface Props {
  userId: string;
  /** true en Mi Esquina: además de mostrar avisos, genera los recordatorios de entreno. */
  reminders?: boolean;
  /** El desplegable se alinea a la derecha por defecto. */
  align?: 'left' | 'right';
}

export default function NotificationBell({ userId, reminders, align = 'right' }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { items, unread, loading, available, markRead, markAllRead, remove } =
    useNotifications(userId, { reminders });

  // Cerrar al pulsar fuera o con Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Si la tabla aún no existe (migración sin aplicar), la campana no se muestra.
  if (!available) return null;

  const openItem = (id: string, link: string | null, isRead: boolean) => {
    if (!isRead) markRead(id);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 text-zinc-300 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
      >
        <i className={unread > 0 ? 'ri-notification-3-fill' : 'ri-notification-3-line'} style={unread > 0 ? { color: '#E10600' } : undefined}></i>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full bg-[#E10600] text-white text-[10px] font-black border-2 border-[#0a0a0a]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-11 ${align === 'right' ? 'right-0' : 'left-0'} w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/[0.1] bg-[#0b0b0b]/98 backdrop-blur-xl overflow-hidden z-50 anim-scale-in`}
          style={{ boxShadow: '0 28px 70px rgba(0,0,0,0.75)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <span className="text-sm font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 2 }}>
              AVISOS
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-bold text-red-400 hover:text-red-300 cursor-pointer transition-colors">
                Marcar todo leído
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="py-10 flex justify-center">
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : items.length === 0 ? (
              <div className="py-11 px-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                  <i className="ri-notification-off-line text-xl text-zinc-600"></i>
                </div>
                <p className="text-sm text-zinc-300 font-medium">Todo tranquilo</p>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Aquí verás tus recordatorios de entreno, mensajes nuevos y respuestas a tus solicitudes.
                </p>
              </div>
            ) : (
              items.map((n) => {
                const st = notifStyle(n.kind);
                const isRead = !!n.read_at;
                return (
                  <div
                    key={n.id}
                    className={`group flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 transition-colors ${isRead ? 'opacity-60' : 'bg-white/[0.02]'} hover:bg-white/[0.05]`}
                  >
                    <button
                      onClick={() => openItem(n.id, n.link, isRead)}
                      className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <span
                        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl border mt-0.5"
                        style={{ background: `${st.color}1a`, borderColor: `${st.color}44`, color: st.color }}
                      >
                        <i className={`${st.icon} text-sm`}></i>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-bold text-white leading-snug">{n.title}</span>
                        {n.body && <span className="block text-xs text-zinc-400 mt-0.5 leading-relaxed line-clamp-2">{n.body}</span>}
                        <span className="block text-[10px] text-zinc-600 mt-1">{notifTimeAgo(n.created_at)}</span>
                      </span>
                      {!isRead && <span className="w-2 h-2 rounded-full bg-[#E10600] flex-shrink-0 mt-2"></span>}
                    </button>
                    <button
                      onClick={() => remove(n.id)}
                      aria-label="Descartar aviso"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-zinc-600 hover:text-white transition-all cursor-pointer mt-1"
                    >
                      <i className="ri-close-line text-sm"></i>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`
        .line-clamp-2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      `}</style>
    </div>
  );
}

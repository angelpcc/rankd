import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, EventBout } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

// Cartelera pública de un evento. Se muestra en la página del evento cuando la
// promotora ha añadido combates. Si no hay (o falta la migración), no renderiza.
export default function EventCard({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bouts, setBouts] = useState<EventBout[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('event_bouts').select('*')
        .eq('event_id', eventId).order('bout_order', { ascending: true });
      if (isMissingTable(error) || !data) { setReady(true); return; }
      setBouts(data as EventBout[]);
      setReady(true);
    };
    load();
  }, [eventId]);

  if (!ready || bouts.length === 0) return null;

  // El estelar arriba del todo; el resto en orden.
  const ordered = [...bouts].sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || a.bout_order - b.bout_order);

  const Corner = ({ pid, name, win }: { pid: string | null; name: string | null; win: boolean }) => {
    const label = name || t('evb_public_tbd');
    const content = (
      <span className={`text-sm sm:text-base font-bold ${win ? 'text-emerald-400' : 'text-white'} ${pid ? 'hover:text-red-400 cursor-pointer' : ''} transition-colors`}>
        {label}{win && <i className="ri-trophy-line ml-1.5 text-xs" />}
      </span>
    );
    return pid ? <button onClick={() => navigate(`/fighter/${pid}`)} className="min-w-0 truncate">{content}</button> : <span className="min-w-0 truncate">{content}</span>;
  };

  return (
    <div className="rk-card" style={{ padding: '20px 22px' }}>
      <h2 className="rk-h3 text-white mb-4 flex items-center gap-2" style={{ fontSize: '1.1rem' }}>
        <i className="ri-sword-line text-red-400" />{t('evb_public_title')}
      </h2>
      <div className="space-y-2.5">
        {ordered.map((bt) => (
          <div key={bt.id} className={`rounded-xl border p-3.5 ${bt.is_main ? 'border-red-500/40 bg-red-600/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {bt.is_main && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-red-300 bg-red-600/15 border border-red-500/30">{t('evb_public_main')}</span>}
              {bt.status === 'tentative' && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-amber-300 bg-amber-500/15 border border-amber-500/30">{t('evb_public_tentative')}</span>}
              {bt.weight_class && <span className="text-[11px] text-zinc-400">{bt.weight_class}</span>}
              {bt.rounds ? <span className="text-[11px] text-zinc-600">· {t('evb_public_rounds', { n: bt.rounds })}</span> : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Corner pid={bt.fighter_a_profile_id} name={bt.fighter_a_name} win={bt.result === 'a'} />
              <span className="text-[10px] font-black text-zinc-600 flex-shrink-0">{t('evb_vs')}</span>
              <div className="text-right"><Corner pid={bt.fighter_b_profile_id} name={bt.fighter_b_name} win={bt.result === 'b'} /></div>
            </div>
            {bt.result === 'draw' && <p className="text-[11px] text-zinc-500 mt-1.5 text-center">{t('evb_result_draw')}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

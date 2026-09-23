// ════════════════════════════════════════════════════════════════
// RANKD · Cardios guardados
//
// ── LA ESTANTERÍA QUE FALTABA ──
//
// Todo lo que entraba en la app tenía que ir a la agenda, y la agenda es lo
// que TIENES que hacer ese día. Así que un cardio de por la mañana que unos
// días haces y otros no, o las dos opciones de un sábado ("pierna suave o
// Hyrox, elige"), no tenían sitio: o los plantabas en un día como obligación,
// o se perdían.
//
// Llenar la agenda de cosas opcionales la convierte en una lista de tareas que
// no se cumple, y cuando una lista no se cumple se deja de mirar.
//
// Aquí están sin fecha. Los haces el día que te apetezca, o los pones en un día
// cuando ya lo sepas.
//
// ── POR QUÉ NO HACÍA FALTA NADA NUEVO POR DEBAJO ──
//
// Los protocolos llevaban guardándose desde siempre: `loadProtocols` y
// `deleteProtocol` estaban escritos enteros y NO LOS LLAMABA NADIE. Solo se
// llegaba a un protocolo si un bloque de la agenda apuntaba a él; si no, existía
// y era invisible. Lo único que faltaba era esta pantalla.
// ════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import ProtocolPlayer from './ProtocolPlayer';
import {
  deleteProtocol, finishRun, loadProtocols, protocolTotals, ultimaVezDe, type RunDone,
  type Protocol, type ProtocolRun,
} from '../lib/protocols';
import { activityKindCfg, todayISO } from '../lib/dayPlan';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Para refrescar la agenda cuando uno de estos se pone en un día. */
  onChanged?: () => void;
}

const clock = (min: number) => `${Math.round(min)} min`;

export default function SavedCardios({ profile, showToast, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const [items, setItems] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<{ protocol: Protocol; ultima: ProtocolRun | null } | null>(null);
  const [guardando, setGuardando] = useState(false);
  /** Protocolo al que se le está eligiendo día, con la fecha tecleada. */
  const [poner, setPoner] = useState<{ p: Protocol; date: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { protocols } = await loadProtocols(profile.id);
    // Sin tramos no hay nada que reproducir: ese protocolo es un hueco, no una
    // sesión, y enseñarlo solo da un botón de play que no lleva a ningún sitio.
    setItems(protocols.filter((p) => (p.segments || []).length > 0));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const abrir = async (p: Protocol) => {
    const ultima = await ultimaVezDe(profile.id, p.id, p.name, p.kind).catch(() => null);
    setPlayer({ protocol: p, ultima });
  };

  const terminar = async (done: RunDone) => {
    if (!player) return;
    setGuardando(true);
    const res = await finishRun(profile.id, player.protocol, done);
    setGuardando(false);
    setPlayer(null);
    if (res.sessionFailed) { showToast(t('error_save'), 'error'); return; }
    showToast(t('mc_sc_logged'));
    onChanged?.();
  };

  const borrar = async (p: Protocol) => {
    setItems((prev) => prev.filter((x) => x.id !== p.id));
    try {
      await deleteProtocol(profile.id, p.id);
      showToast(t('mc_sc_deleted'));
    } catch {
      showToast(t('error_save'), 'error');
      load();
    }
  };

  /** Del estante a un día concreto. Ahí sí pasa a ser algo que toca hacer. */
  const ponerEnDia = async () => {
    if (!poner || !poner.date) return;
    const cfg = activityKindCfg(poner.p.kind);
    const { error } = await supabase.from('day_plan_items').insert({
      fighter_profile_id: profile.id,
      plan_date: poner.date,
      kind: 'activity',
      payload: {
        kind: poner.p.kind,
        protocol_id: poner.p.id,
        protocol_name: poner.p.name,
        duration_min: Math.round(protocolTotals(poner.p).seconds / 60),
      },
      source: 'manual',
      completed: false,
    });
    if (error) { showToast(t('error_save'), 'error'); return; }
    showToast(t('mc_sc_placed', { date: new Date(poner.date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) }));
    setPoner(null);
    void cfg;
    onChanged?.();
  };

  if (loading || items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-white">{t('mc_sc_title')}</p>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{t('mc_sc_sub')}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5 items-stretch">
        {items.map((p) => {
          const cfg = activityKindCfg(p.kind);
          const tot = protocolTotals(p);
          return (
            <div key={p.id} className="rk-card flex flex-col" style={{ padding: '14px 16px' }}>
              <div className="flex items-start gap-2.5">
                <i className={`${cfg.icon} text-lg flex-shrink-0 mt-0.5`} style={{ color: cfg.hex }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white leading-snug truncate">{p.name}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {t(cfg.labelKey)} · {clock(tot.seconds / 60)} · {t('mc_sc_segments', { n: (p.segments || []).length })}
                  </p>
                </div>
                <button onClick={() => borrar(p)} aria-label={t('mc_delete')}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors">
                  <i className="ri-delete-bin-line text-sm" />
                </button>
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={() => abrir(p)}
                  className="rk-btn rk-press flex-1 flex items-center justify-center gap-1.5"
                  style={{ minHeight: 42, fontSize: '0.8rem', background: 'var(--accent)', color: '#fff' }}>
                  <i className="ri-play-fill text-base" />{t('mc_sc_do_now')}
                </button>
                <button onClick={() => setPoner({ p, date: todayISO() })}
                  className="rk-nav-btn rk-press flex items-center justify-center gap-1.5 px-3"
                  style={{ minHeight: 42, fontSize: '0.78rem' }}>
                  <i className="ri-calendar-line" />{t('mc_sc_place')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Elegir día. Un input de fecha y ya: cualquier cosa más elaborada para
          escoger un día es más pantalla de la que hace falta. */}
      {poner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPoner(null); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative rk-card w-full max-w-sm" style={{ padding: 20 }}>
            <p className="text-sm font-bold text-white">{t('mc_sc_place_title')}</p>
            <p className="text-xs text-zinc-500 mt-1 mb-3 truncate">{poner.p.name}</p>
            <input type="date" value={poner.date} min={todayISO()}
              onChange={(e) => setPoner((s) => (s ? { ...s, date: e.target.value } : s))}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
              style={{ fontSize: 16, minHeight: 44 }} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setPoner(null)} className="rk-nav-btn rk-press flex-1" style={{ minHeight: 46 }}>
                {t('mc_cancel')}
              </button>
              <button onClick={ponerEnDia} disabled={!poner.date} className="rk-cta rk-press flex-1 disabled:opacity-50" style={{ minHeight: 46 }}>
                {t('mc_sc_place_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {player && (
        <ProtocolPlayer protocol={player.protocol} saving={guardando} ultima={player.ultima}
          onExit={() => setPlayer(null)} onFinish={terminar} />
      )}
    </div>
  );
}

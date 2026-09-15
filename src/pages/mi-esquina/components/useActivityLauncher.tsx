// ════════════════════════════════════════════════════════════════
// RANKD · Mi Esquina · Abrir lo que resuelve un bloque de ACTIVIDAD
//
// ── EL PROBLEMA QUE ARREGLA ──
//
// Un cardio planificado se podía tocar desde dos sitios —el bloque del día en
// la Agenda y la tarjeta "hoy toca" de Actividad— y cada uno hacía una cosa
// distinta. El de la Agenda ejecutaba; el de Actividad abría el formulario de
// registro a mano, más abajo de donde estabas, sin llevarte a él. Desde fuera
// eso es "le doy y no hace nada".
//
// Peor: la lógica de "¿qué abre este bloque?" estaba escrita entera dentro de
// la Agenda. Copiarla a Actividad habría garantizado que en seis semanas las
// dos volvieran a discrepar. Por eso está aquí y las dos la usan.
//
// ── QUÉ HACE, EN ORDEN ──
//
//   1. ¿Trae sesión de boxeo? → al TEMPORIZADOR, con los asaltos puestos.
//   2. ¿Trae protocolo? → al REPRODUCTOR, tramo a tramo.
//   3. ¿Es un cardio del plan sin guion? → se ofrece montarlo (ver abajo).
//   4. Cualquier otra cosa → al formulario de registro.
//
// Siempre hay una salida. Esa es la regla: un bloque que se ve tiene que poder
// resolverse, y la del punto 3 es la que faltaba.
//
// ── POR QUÉ SE PREGUNTA ANTES DE MONTAR EL GUION ──
//
// Montarlo cuesta saldo de verdad. Gastarlo por tocar una fila, sin avisar, no
// es aceptable. Se pregunta una vez; lo que sale se guarda y ya no se paga más.
//
// ── POR QUÉ EL BOXEO VA POR OTRO LADO ──
//
// Un cardio se sigue por minutos (velocidad, inclinación, ritmo); el boxeo por
// ASALTOS. Meter el boxeo por el reproductor de tramos daría un guion de
// "esfuerzo 7" durante 40 minutos, que no dice nada. Va al generador de
// asaltos y de ahí al temporizador, que es quien sabe contarlos — y por eso
// hay que preguntar dónde se entrena: sin saco, un asalto es otra cosa.
// ════════════════════════════════════════════════════════════════

import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import BottomSheet from '@/components/base/BottomSheet';
import ProtocolPlayer from './ProtocolPlayer';
import { activityKindCfg, type ActivityPayload } from '../lib/dayPlan';
import { finishRun, loadProtocolById, localId as protocolLocalId, saveProtocol, type Protocol } from '../lib/protocols';
import { BOXING_PLACES, saveBoxingSession, type BoxingPlace } from '../lib/boxing';
import { designCardio } from '@/services/protocolImport';
import { generateBoxingSession } from '@/services/boxingAdvisor';

/** Lo mínimo que hace falta saber de un bloque para poder abrirlo. */
export interface ActividadLanzable {
  /** id en `day_plan_items`, para marcarlo hecho y para engancharle el guion. */
  id: string;
  /** Fecha del bloque (ISO). La sesión se registra con ESTA, no con hoy. */
  planDate: string;
  payload: ActivityPayload;
  /** manual | advisor | template. Decide si se ofrece montar el guion. */
  source: string;
}

interface Opciones {
  profile: Profile;
  showToast: (msg: string, tipo?: 'success' | 'error') => void;
  /** Ir al temporizador del Ring con una sesión de boxeo cargada. */
  onGoBoxing?: (sessionId: string) => void;
  /** Caída al registro a mano, con el día y el tipo ya puestos. */
  onLogManual: (date: string, kind: string) => void;
  /** Algo ha cambiado (sesión registrada, bloque marcado): a releer. */
  onDone?: () => void;
}

/**
 * Duración mínima para ofrecer un guion. Por debajo de cinco minutos no hay
 * nada que desglosar y la pregunta sobra.
 */
const MIN_MIN = 5;

/** ¿Este bloque puede recibir un guion generado? */
export function puedeMontarGuion(source: string, p: ActivityPayload): boolean {
  if (p.protocol_id || p.boxing_id) return false;
  if (source !== 'advisor' && source !== 'template') return false;
  return (p.duration_min || 0) >= MIN_MIN;
}

export function useActivityLauncher({ profile, showToast, onGoBoxing, onLogManual, onDone }: Opciones) {
  const { t } = useTranslation();
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [player, setPlayer] = useState<{ item: ActividadLanzable; protocol: Protocol } | null>(null);
  const [guardando, setGuardando] = useState(false);
  /** Bloque al que le falta el guion, esperando respuesta. */
  const [preguntar, setPreguntar] = useState<ActividadLanzable | null>(null);
  const [montando, setMontando] = useState(false);
  /** Solo para boxeo: dónde se entrena. Sin esto no se puede generar. */
  const [place, setPlace] = useState<BoxingPlace | null>(null);

  const cerrarPregunta = () => { if (!montando) { setPreguntar(null); setPlace(null); } };

  const abrir = useCallback(async (item: ActividadLanzable) => {
    const p = item.payload;
    setAbriendo(item.id);
    try {
      // 1. Boxeo ya generado: al temporizador, que es quien cuenta asaltos.
      if (p.boxing_id && onGoBoxing) { onGoBoxing(p.boxing_id); return; }

      // 2. Con protocolo detrás, se reproduce aquí mismo.
      if (p.protocol_id) {
        const protocol = await loadProtocolById(profile.id, p.protocol_id);
        if (protocol) { setPlayer({ item, protocol }); return; }
        // Borrado después de planificarlo: no se deja al usuario tirado.
        showToast(t('mc_ag_run_missing'), 'error');
      }

      // 3. Cardio del plan sin guion: se ofrece montarlo.
      if (puedeMontarGuion(item.source, p)) { setPreguntar(item); return; }

      // 4. Siempre queda el registro a mano.
      onLogManual(item.planDate, p.kind);
    } finally {
      setAbriendo(null);
    }
  }, [profile.id, showToast, t, onGoBoxing, onLogManual]);

  /** Genera el guion del bloque que está esperando y lo abre. */
  const montar = async () => {
    const item = preguntar;
    if (!item) return;
    const p = item.payload;
    const minutos = p.duration_min || 30;
    const intencion = [p.protocol_name, p.note].filter(Boolean).join('. ');
    setMontando(true);

    // ── Boxeo: asaltos, no tramos ──
    if (p.kind === 'boxeo') {
      if (!place) { setMontando(false); return; }
      const { session, error } = await generateBoxingSession({
        minutes: minutos, place, notes: intencion,
        profile: profile as unknown as Record<string, unknown>,
      });
      if (!session) { setMontando(false); showToast(error || t('mc_ag_cardio_failed'), 'error'); return; }
      const { session: guardada } = await saveBoxingSession(profile.id, session);
      await engancharAlBloque(item, { boxing_id: guardada.id, protocol_name: guardada.name });
      setMontando(false);
      setPreguntar(null);
      setPlace(null);
      if (onGoBoxing) onGoBoxing(guardada.id);
      else showToast(t('mc_ag_cardio_failed'), 'error');
      return;
    }

    // ── El resto: guion por tramos ──
    const { protocol: disenado, error } = await designCardio({
      kind: p.kind, minutes: minutos, intent: intencion,
      profile: profile as unknown as Record<string, unknown>,
    });
    if (!disenado) { setMontando(false); showToast(error || t('mc_ag_cardio_failed'), 'error'); return; }

    const { protocol } = await saveProtocol(profile.id, {
      id: protocolLocalId('prot'),
      name: p.protocol_name || disenado.name,
      kind: p.kind,
      segments: disenado.segments,
      note: disenado.note,
      // 'import' y no otra cosa: el tipo de Protocol solo distingue entre lo que
      // escribió el usuario a mano y lo que no.
      source: 'import',
      createdAt: new Date().toISOString(),
    });

    const payload = await engancharAlBloque(item, { protocol_id: protocol.id, protocol_name: protocol.name });
    setMontando(false);
    setPreguntar(null);
    setPlayer({ item: { ...item, payload }, protocol });
  };

  /**
   * Deja el bloque del día apuntando a lo que se acaba de generar.
   *
   * Sin esto, mañana volvería a preguntar y a cobrar por lo mismo.
   */
  const engancharAlBloque = async (item: ActividadLanzable, extra: Partial<ActivityPayload>) => {
    const payload = { ...item.payload, ...extra } as ActivityPayload;
    await supabase.from('day_plan_items').update({ payload }).eq('id', item.id);
    onDone?.();
    return payload;
  };

  /** Cierre del reproductor: guarda la sesión y marca el bloque. */
  const terminar = async (done: { secondsDone: number; segmentsDone: number; completed: boolean; distanceMeters: number }) => {
    if (!player) return;
    setGuardando(true);
    const res = await finishRun(profile.id, player.protocol, done, player.item.planDate);
    setGuardando(false);
    if (res.sessionFailed) { showToast(t('error_save'), 'error'); return; }

    const id = player.item.id;
    setPlayer(null);
    // El tick se pone a mano además de dejar que la reconciliación por tipo
    // haga su trabajo: acierta casi siempre, pero "casi" no vale cuando el
    // usuario acaba de terminar ESE bloque delante de la pantalla.
    await supabase.from('day_plan_items').update({ completed: true }).eq('id', id);
    onDone?.();
    showToast(t('mc_ag_run_done'));
  };

  const esBoxeo = preguntar?.payload.kind === 'boxeo';
  // El boxeo no se puede generar sin saber dónde se entrena: sin saco el asalto
  // es sombra y desplazamientos, con saco es otra cosa. Se pregunta, no se supone.
  const listoParaMontar = !esBoxeo || !!place;

  const overlays: ReactNode = (
    <>
      {player && (
        <ProtocolPlayer protocol={player.protocol} saving={guardando}
          onExit={() => setPlayer(null)} onFinish={terminar} />
      )}

      <BottomSheet open={!!preguntar} onClose={cerrarPregunta} title={t(esBoxeo ? 'mc_ag_boxing_title' : 'mc_ag_cardio_title')}>
        {preguntar && (() => {
          const p = preguntar.payload;
          const cfg = activityKindCfg(p.kind);
          return (
            <>
              <div className="rk-card mb-4" style={{ padding: 14 }}>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <i className={cfg.icon} style={{ color: cfg.hex }} />
                  {p.protocol_name || t(cfg.labelKey)}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {t(cfg.labelKey)}{p.duration_min ? ` · ${p.duration_min} min` : ''}
                </p>
                {p.note && <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{p.note}</p>}
              </div>

              <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--t-2)' }}>
                {t(esBoxeo ? 'mc_ag_boxing_desc' : 'mc_ag_cardio_desc')}
              </p>

              {esBoxeo && (
                <div className="space-y-1.5 mb-4">
                  <p className="rk-label">{t('mc_bx_q_place')}</p>
                  {BOXING_PLACES.map((o) => (
                    <button key={o.v} type="button" onClick={() => setPlace(o.v)} disabled={montando}
                      className={`w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left cursor-pointer transition-colors disabled:opacity-60 ${place === o.v ? 'border-white/30 bg-white/[0.07]' : 'border-white/10 hover:border-white/25'}`}
                      style={{ minHeight: 52 }}>
                      <i className={`${o.icon} text-lg flex-shrink-0`} style={{ color: place === o.v ? 'var(--accent)' : '#71717a' }} />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-white">{t(o.label)}</span>
                        <span className="block text-[10px] text-zinc-500 mt-0.5 leading-tight">{t(o.hint)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <button onClick={montar} disabled={montando || !listoParaMontar}
                className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ minHeight: 48 }}>
                {montando
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('mc_ag_cardio_building')}</>
                  : <><i className="ri-sparkling-2-line" /> {t(esBoxeo ? 'mc_ag_boxing_build' : 'mc_ag_cardio_build')}</>}
              </button>

              <button onClick={() => { const x = preguntar; setPreguntar(null); setPlace(null); onLogManual(x.planDate, x.payload.kind); }}
                disabled={montando}
                className="rk-btn w-full flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                style={{ minHeight: 48 }}>
                <i className="ri-edit-box-line" /> {t('mc_ag_cardio_manual')}
              </button>
            </>
          );
        })()}
      </BottomSheet>
    </>
  );

  return { abrir, overlays, abriendo };
}

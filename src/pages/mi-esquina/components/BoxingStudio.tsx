import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase, type Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import {
  BOXING_PLACES, boxingSummary, boxingTotalMin, loadBoxingSessions, saveBoxingSession,
  type BoxingPlace, type BoxingSession,
} from '../lib/boxing';
import { checkBoxingAvailable, generateBoxingSession } from '@/services/boxingAdvisor';
import PlanLanding from './PlanLanding';
import { landBoxing } from '../lib/planLanding';
import { loadAgendaSnapshot } from '../lib/agendaSnapshot';
import { currentWeekStart } from '../lib/weekPlan';

// ════════════════════════════════════════════════════════════════
// ENTRENO DE BOXEO POR ASALTOS (punto 28)
//
// Dices el tiempo que tienes y dónde entrenas, y sale la sesión entera:
// calentamiento, N asaltos con su guion, descansos y vuelta a la calma.
//
// ── LOS DOS DATOS SE PIDEN, NO SE SUPONEN ──
//
// El tiempo, porque es el límite duro: sin él la sesión sale de 40 minutos o de
// 90 y acierta por casualidad.
//
// El sitio, porque cambia el entreno entero. Sin saco, un asalto es sombra,
// desplazamientos y técnica en vacío; con saco y material se estructura de otra
// forma. Suponerlo es devolverle a alguien que entrena en su salón una sesión
// de saco y manoplas — inservible. Por eso son los dos primeros controles de la
// pantalla y no hay valor por defecto que colar.
//
// ── LO QUE HACE QUE ESTO NO SEA UN TEXTO BONITO ──
//
// El botón de empezar lleva al TEMPORIZADOR DEL RING con los asaltos ya
// configurados. Si hubiera que ir a teclear 8, 2:00 y 1:00 a mano, la sesión
// generada no serviría de nada.
// ════════════════════════════════════════════════════════════════

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

/** Tiempos que la gente dice de verdad. Evita teclear un número. */
/**
 * Disciplinas que sabe montar por asaltos.
 *
 * `txt` es lo que se le dice al generador: una frase, no un código, porque el
 * prompt lo lee como contexto y una etiqueta suelta ("muay_thai") no le dice
 * qué cambiar.
 */
const DISCIPLINAS: { v: string; labelKey: string; txt: string }[] = [
  { v: 'boxeo', labelKey: 'mc_bx_disc_boxing', txt: 'Es una sesión de BOXEO: solo manos' },
  { v: 'kickboxing', labelKey: 'mc_bx_disc_kick', txt: 'Es una sesión de KICKBOXING: manos y patadas, sin rodillas ni codos' },
  { v: 'muay_thai', labelKey: 'mc_bx_disc_muay', txt: 'Es una sesión de MUAY THAI: manos, patadas, rodillas, codos y clinch' },
  { v: 'mma', labelKey: 'mc_bx_disc_mma', txt: 'Es una sesión de MMA: golpeo de pie más entradas a derribo y trabajo en el suelo si el sitio lo permite' },
];

/** Lo que más se tiene en casa, para no teclearlo. */
const MATERIAL_RAPIDO = [
  'mc_bx_gear_rope', 'mc_bx_gear_dumbbells', 'mc_bx_gear_bands',
  'mc_bx_gear_pads', 'mc_bx_gear_kettlebell', 'mc_bx_gear_partner',
];

const MINUTOS = [30, 45, 60, 75, 90];

export default function BoxingStudio({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [minutes, setMinutes] = useState<number | null>(null);
  const [place, setPlace] = useState<BoxingPlace | null>(null);
  /**
   * Qué se entrena. El boxeo es el caso principal, pero el guion de un asalto
   * de muay thai o de MMA no es el mismo: cambian los golpes y cambia el
   * trabajo de piernas. Con una sola opción, a un tailandés le salían solo
   * manos.
   */
  const [disc, setDisc] = useState<string>('boxeo');
  /**
   * Material que tiene de verdad.
   *
   * "En casa" y "en casa con saco" cubren lo más común, pero no el resto: unas
   * peras, unas mancuernas, una comba, unas bandas. Sin poder decirlo, el
   * guion daba por hecho lo mínimo y se dejaba fuera lo que sí tienes.
   */
  const [material, setMaterial] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<BoxingSession[]>([]);
  const [localOnly, setLocalOnly] = useState(false);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [fighter, setFighter] = useState<Record<string, unknown>>({});
  /** Sesión recién generada esperando a que se le asignen días en la semana. */
  const [porColocar, setPorColocar] = useState<BoxingSession | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [lista, f] = await Promise.all([
        loadBoxingSessions(profile.id),
        supabase.from('fighters').select('discipline, weight_class, experience_level, age')
          .eq('profile_id', profile.id).maybeSingle(),
      ]);
      if (!alive) return;
      setSessions(lista.sessions);
      setLocalOnly(lista.storedLocally);
      const fr = f.data as { discipline?: string; weight_class?: string; experience_level?: string; age?: number } | null;
      setFighter({
        discipline: fr?.discipline, level: fr?.experience_level,
        weightClass: fr?.weight_class, age: fr?.age,
      });
    })();
    checkBoxingAvailable().then((ok) => { if (alive) setAiOk(ok); });
    return () => { alive = false; };
  }, [profile.id]);

  // Faltan datos mientras no estén los dos. Se dice cuál falta, no un genérico.
  const falta = useMemo(() => {
    if (minutes === null) return t('mc_bx_need_time');
    if (place === null) return t('mc_bx_need_place');
    return null;
  }, [minutes, place, t]);

  const generar = async () => {
    if (minutes === null || place === null || busy) return;
    setBusy(true);
    // La agenda se lee AHORA, no al montar: puede haber cambiado mientras
    // elegías el tiempo y el sitio.
    const agendaAhora = await loadAgendaSnapshot(profile.id, currentWeekStart(), 1).catch(() => []);
    // El material y la disciplina viajan con las notas: el generador ya sabe
    // leer texto libre ahí, así que no hace falta otro campo en el servidor
    // para algo que es, literalmente, contexto en palabras.
    const extra = [
      DISCIPLINAS.find((x) => x.v === disc)?.txt,
      material.trim() ? `Material que tengo: ${material.trim()}` : '',
      notes.trim(),
    ].filter(Boolean).join('. ');
    const res = await generateBoxingSession({ minutes, place, notes: extra, profile: fighter, agenda: agendaAhora });
    if (!res.session) {
      setBusy(false);
      showToast(res.error === 'auth' ? t('mc_bx_err_auth') : (res.error || t('mc_bx_err_gen')), 'error');
      return;
    }
    const guardada = await saveBoxingSession(profile.id, res.session);
    setBusy(false);
    if (guardada.storedLocally) { setLocalOnly(true); showToast(t('mc_bx_saved_local')); }
    setSessions((l) => [guardada.session, ...l]);
    // Se ofrece ponerlo en la semana justo ahora, con el entreno delante: es
    // cuando se sabe qué días se va a hacer. Se puede saltar.
    setPorColocar(guardada.session);
  };

  /**
   * Abre el temporizador con ESTA sesión ya configurada.
   *
   * Va por la URL y no por el estado de navegación para que el mismo enlace
   * sirva desde la Agenda, desde aquí o desde un acceso directo, y sobreviva a
   * recargar la página.
   */
  const empezar = (s: BoxingSession) => navigate(`/mi-esquina/timer?session=${encodeURIComponent(s.id)}`);

  /** Los días elegidos se convierten en bloques de actividad de la Agenda. */
  const colocar = async (dows: number[]) => {
    if (!porColocar) return;
    setBusy(true);
    // Se reutiliza el aterrizaje de los protocolos: un entreno de boxeo es una
    // actividad más en la Agenda, con su tipo y sus minutos. Lo que cambia es
    // que el bloque apunta a la sesión de boxeo, no a un protocolo de tramos.
    // El id solo viaja si la sesión llegó a la base: sin él, el bloque del día
    // sigue diciendo qué toca, pero no puede arrancar el temporizador solo.
    const guardadaArriba = !porColocar.id.startsWith('bx_');
    const r = await landBoxing(profile.id, porColocar, guardadaArriba ? porColocar.id : null, dows);
    setBusy(false);
    if (r.error) { showToast(t('error_save'), 'error'); return; }
    showToast(t('mc_land_added', { count: r.added }));
    setPorColocar(null);
  };

  if (porColocar) {
    return (
      <PlanLanding
        boxing={porColocar}
        saving={busy}
        onConfirmProtocol={colocar}
        onCancel={() => setPorColocar(null)}
      />
    );
  }

  return (
    <div className="rk-blocks max-w-3xl">
      <div className="rk-card" style={{ padding: 18 }}>
        {/* La misma cabecera que los otros dos chats del Asesor: son tres formas
            de pedirle lo mismo y tienen que parecer la misma herramienta. */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl rk-ai-avatar">
            <i className="ri-boxing-line text-lg" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{t('mc_bx_title')}</p>
            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full rk-alive" style={{ background: '#E10600', color: '#E10600' }} />
              {t('mc_bx_head_sub')}
            </p>
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3 leading-relaxed">{t('mc_bx_desc')}</p>

        {/* ── 0. Qué entrena ──
            Primero porque cambia TODO lo de abajo: los golpes, el trabajo de
            piernas y hasta qué material tiene sentido. */}
        <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mt-4 mb-1.5">
          {t('mc_bx_q_disc')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DISCIPLINAS.map((o) => (
            <button key={o.v} type="button" onClick={() => setDisc(o.v)}
              className={`rk-chip text-xs font-semibold rounded-full px-3 py-2 cursor-pointer border ${disc === o.v ? 'border-white/30 bg-white/[0.07] text-white' : 'border-white/10 text-zinc-300 hover:border-white/25'}`}>
              {t(o.labelKey)}
            </button>
          ))}
        </div>

        {/* ── 1. Cuánto tiempo ── */}
        <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mt-4 mb-1.5">
          {t('mc_bx_q_time')}
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {MINUTOS.map((m) => (
            <button key={m} type="button" onClick={() => setMinutes(m)}
              className={`rk-chip rounded-xl border text-sm font-bold cursor-pointer ${minutes === m ? 'border-white/30 text-white' : 'border-white/10 text-zinc-400 hover:border-white/25'}`}
              style={{
                minHeight: 46,
                // El elegido con el mismo relieve que la burbuja propia del chat:
                // plano se confundía con los demás en una pantalla al sol.
                background: minutes === m ? 'linear-gradient(145deg, #F01A14 0%, #C60500 100%)' : 'rgba(255,255,255,0.02)',
                boxShadow: minutes === m ? '0 6px 16px -8px rgba(225,6,0,0.8)' : 'none',
              }}>
              {m}′
            </button>
          ))}
        </div>

        {/* ── 2. Dónde ──
            No es un detalle de material: sin saco el entreno es OTRO. */}
        <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mt-4 mb-1.5">
          {t('mc_bx_q_place')}
        </p>
        <div className="space-y-1.5">
          {(BOXING_PLACES).map((o) => (
            <button key={o.v} type="button" onClick={() => setPlace(o.v)}
              className={`w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left cursor-pointer transition-colors ${place === o.v ? 'border-white/30 bg-white/[0.07]' : 'border-white/10 hover:border-white/25'}`}
              style={{ minHeight: 52 }}>
              <i className={`${o.icon} text-lg flex-shrink-0`} style={{ color: place === o.v ? 'var(--accent)' : '#71717a' }} />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-white">{t(o.label)}</span>
                <span className="block text-[10px] text-zinc-500 mt-0.5 leading-tight">{t(o.hint)}</span>
              </span>
            </button>
          ))}
        </div>

        {/* ── 3. Qué material tienes ──
            Va DEBAJO del sitio y no dentro: el sitio dice si hay saco o no, que
            es lo que parte el guion en dos; el material es el matiz que lo
            afina. Con las dos cosas, "en casa" deja de significar "solo sombra"
            si resulta que tienes comba y mancuernas. */}
        <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mt-4 mb-1.5">
          {t('mc_bx_q_gear')}
        </p>
        <input value={material} onChange={(e) => setMaterial(e.target.value)} maxLength={200}
          placeholder={t('mc_bx_gear_ph')}
          className="w-full rounded-xl bg-white/[0.03] border border-white/10 text-white p-3 focus:outline-none focus:border-white/25"
          style={{ fontSize: 16 }} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {/* Atajos para lo que más se tiene. Se suman al texto en vez de
              reemplazarlo: quien tiene tres cosas las toca las tres. */}
          {MATERIAL_RAPIDO.map((k) => (
            <button key={k} type="button"
              onClick={() => setMaterial((p) => (p.trim() ? `${p.trim()}, ${t(k)}` : t(k)))}
              className="rk-chip text-[11px] text-zinc-400 border border-white/10 hover:border-white/25 hover:text-white rounded-full px-2.5 py-1 cursor-pointer">
              + {t(k)}
            </button>
          ))}
        </div>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder={t('mc_bx_notes_ph')} maxLength={400}
          className="w-full rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white p-3 mt-4 resize-y focus:outline-none focus:border-white/25" />

        <button onClick={generar} disabled={busy || !!falta}
          className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          style={{ minHeight: 48 }}>
          {busy
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><i className="ri-sparkling-2-line" /> {t('mc_bx_generate')}</>}
        </button>
        {falta && <p className="text-[11px] text-zinc-500 mt-2 text-center">{falta}</p>}
        {aiOk === false && <p className="text-[11px] text-[#C9A84C] mt-2 text-center leading-relaxed">{t('mc_bx_no_ai')}</p>}
        {localOnly && <p className="text-[11px] text-[#C9A84C] mt-2 leading-relaxed">{t('mc_bx_local_only')}</p>}
      </div>

      {/* ── Lo generado, listo para lanzar ── */}
      {sessions.length > 0 && (
        <div className="space-y-2.5">
          <p className="rk-label">{t('mc_bx_mine')}</p>
          {sessions.map((s, i) => (
            <Reveal key={s.id} delay={Math.min(i, 6) * 40}>
              <div className="rk-card" style={{ padding: '14px 16px' }}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0 rk-ai-avatar">
                    <i className="ri-boxing-line text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.name}</p>
                    {/* Los números en pastillas, no en una línea gris separada por
                        puntos: de un vistazo se ve cuánto dura y cómo está
                        repartida, que es lo que se mira antes de elegir una. */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {[
                        { icon: 'ri-repeat-2-line', txt: boxingSummary(s) },
                        { icon: 'ri-time-line', txt: t('mc_bx_total', { n: boxingTotalMin(s) }) },
                        {
                          icon: BOXING_PLACES.find((p) => p.v === s.place)?.icon || 'ri-home-4-line',
                          txt: t(BOXING_PLACES.find((p) => p.v === s.place)?.label || 'mc_bx_place_home'),
                        },
                      ].map(({ icon, txt }) => (
                        <span key={txt} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200 rounded-lg px-2 py-1"
                          style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <i className={icon} style={{ color: 'var(--accent)' }} />{txt}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {s.script.length > 0 && (
                  <ol className="mt-3 space-y-1.5">
                    {s.script.slice(0, 4).map((r) => (
                      <li key={r.round} className="flex items-center gap-2.5">
                        {/* El número del asalto en su chapa. Un "1." en gris
                            delante del texto se pierde; así se cuentan los
                            asaltos sin leer. */}
                        <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg text-[11px] font-bold text-white"
                          style={{ background: 'rgba(225,6,0,0.18)' }}>{r.round}</span>
                        <span className="text-xs text-zinc-200 font-semibold truncate">{r.title}</span>
                      </li>
                    ))}
                    {s.script.length > 4 && (
                      <li className="text-[11px] text-zinc-600 pl-[34px]">{t('mc_bx_more', { n: s.script.length - 4 })}</li>
                    )}
                  </ol>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => empezar(s)}
                    className="rk-cta rk-press flex-1 flex items-center justify-center gap-2"
                    style={{ minHeight: 44, fontSize: '0.85rem' }}>
                    <i className="ri-play-fill text-lg" />{t('mc_bx_start')}
                  </button>
                  <button onClick={() => setPorColocar(s)}
                    className="rk-nav-btn rk-press text-xs px-3" style={{ minHeight: 44 }}>
                    <i className="ri-calendar-line mr-1" />{t('mc_bx_to_week')}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

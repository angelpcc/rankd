import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/base/BottomSheet';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import VoiceButton from '@/components/feature/VoiceButton';
import { activityKindCfg, fmtSetCount } from '../lib/dayPlan';
import type { ProtocolSegment } from '../lib/protocols';
import {
  archiveWeekPlan, commitWeekPlan, currentWeekStart, dateOfWeekday, loadActivePlan, planTotals, weeksOf,
  type CommitResult, type WeekPlan,
} from '../lib/weekPlan';
import { buildWeekContext, checkWeekPlanAvailable } from '@/services/weekPlanAdvisor';
import { sendPlanChat, type PlanChatMessage } from '@/services/planChat';
import { clearChat, loadChat, saveChat } from '../lib/chatHistory';
import { compactarAgenda, loadAgendaSnapshot, loadTrainedRecent, type AgendaDia, type DiaEntrenado } from '../lib/agendaSnapshot';
import PhotoAttach, { FotoPendiente } from './PhotoAttach';
import { limitarAdjuntos, type ImagenLista } from '@/lib/imageInput';
import { cargarDatosObjetivo, contextoCuerpoParaIA } from '../lib/objetivoDiario';

// ════════════════════════════════════════════════════════════════
// EL PLAN, HABLANDO
//
// ── POR QUÉ ESTA PANTALLA SUSTITUYE A DOS ──
//
// Había "plan por objetivo" y "plan semanal", y las dos eran formularios:
// escribes en una caja, pulsas un botón, sale un plan. Nadie planifica así, y
// tener dos pestañas para lo mismo confundía sin dar nada a cambio.
//
// Aquí se habla. Dices lo que quieres, te pregunta lo que falte, el plan
// aparece DENTRO de la conversación, y sigues hablando encima de él: "el jueves
// no puedo", "proponme otra cosa para la cena". Cuando cuadra, lo mandas a la
// app de un toque.
//
// ── EL PLAN VIVE EN EL CHAT, NO DEBAJO ──
//
// La tabla se pinta como un mensaje más, en su sitio de la conversación. Así se
// ve qué versión respondía a qué petición, y pedir un cambio no es "volver
// atrás a un formulario": es seguir hablando.
// ════════════════════════════════════════════════════════════════

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onGoAgenda?: () => void;
}

/** Un turno. `plan` solo en los del entrenador que traen plan nuevo. */
interface Turno {
  role: 'user' | 'assistant';
  content: string;
  plan?: WeekPlan;
  /**
   * Foto que mandó el usuario con ese turno.
   *
   * No va al historial guardado: una foto son cientos de KB y en localStorage
   * caben unos pocos MB en total. Guardarlas llenaría el hueco y se perderían
   * TODAS las conversaciones, que es mucho peor que perder una miniatura.
   */
  image?: ImagenLista;
}

/** "martes 16 sept" — el día tal y como se lee, no la inicial. */
function etiquetaDia(plan: WeekPlan, weekday: number, locale: string): string {
  const iso = dateOfWeekday(plan.weekStart, weekday, 0);
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

export default function PlanChat({ profile, showToast, onGoAgenda }: Props) {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState('');
  /**
   * Lo que hay puesto en la Agenda ahora mismo.
   *
   * Se relee en cada envío y no solo al montar: entre dos mensajes puedes
   * haberte ido a la Agenda, movido un día y vuelto. Mandar la foto de hace
   * diez minutos haría que el asesor razonara sobre algo que ya no existe.
   */
  const [agenda, setAgenda] = useState<AgendaDia[]>([]);
  /** Por dónde va el guardado. Montar los guiones de cardio tarda. */
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  /** Lo entrenado de verdad estos días, planificado o no. */
  const [historial, setHistorial] = useState<DiaEntrenado[]>([]);
  /**
   * El plan que está AHORA MISMO en la Agenda, si hay alguno.
   *
   * No es lo mismo que `plan`: `plan` es el de esta conversación, que puede ser
   * uno nuevo todavía sin guardar. Hacen falta los dos para poder preguntar
   * "ya tienes uno, ¿lo sustituyo?" en vez de apilarlos.
   */
  const [activoEnAgenda, setActivoEnAgenda] = useState<WeekPlan | null>(null);
  /** Plan viejo esperando a que decidas qué hacer con él. */
  const [choque, setChoque] = useState<WeekPlan | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [foto, setFoto] = useState<ImagenLista | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [guardado, setGuardado] = useState<CommitResult | null>(null);
  // La duración ya no se elige con botones: se dice hablando ("dos semanas"),
  // que es lo natural en un chat. Se guarda lo que haya pedido el plan vivo
  // para que un ajuste posterior no le cambie la duración sin avisar.
  const [weeks, setWeeks] = useState(1);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [fighter, setFighter] = useState<Record<string, unknown>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // La caja de texto crece con lo que se escribe, hasta su tope (maxHeight).
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [texto]);

  const weekStart = useMemo(() => currentWeekStart(), []);
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const ctx = useMemo(() => buildWeekContext(weekStart, today, lang, weeks), [weekStart, today, lang, weeks]);

  useEffect(() => {
    let alive = true;
    checkWeekPlanAvailable().then((ok) => { if (alive) setAiOk(ok); });
    (async () => {
      const [activo, f, w, g, cuerpo] = await Promise.all([
        // El plan que ya esté vivo se carga de entrada: pedir un cambio sobre él
        // debe modificarlo, no crear otro encima (punto 27).
        loadActivePlan(profile.id),
        supabase.from('fighters').select('discipline, weight_class, experience_level, age')
          .eq('profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('weight_kg')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg')
          .eq('fighter_profile_id', profile.id).maybeSingle(),
        // Altura, sexo, edad y el objetivo diario de calorías: sin esto, las
        // comidas que proponía no cuadraban con el número que enseña la app.
        cargarDatosObjetivo(profile.id).catch(() => null),
      ]);
      if (!alive) return;
      // Primero la conversación que quedó a medias: es lo que el usuario dejó
      // abierto. Salir a mirar la Agenda y volver no puede borrar cinco turnos
      // de trabajo, y menos cuando cada turno cuesta dinero.
      if (activo) setActivoEnAgenda(activo.plan);
      const guardados = loadChat(profile.id, 'plan');
      if (guardados.length > 0) {
        setTurnos(guardados.map((x) => ({
          role: x.role, content: x.content,
          ...(x.data ? { plan: x.data as WeekPlan } : {}),
        })));
        // El plan vigente es el del último turno que traía uno.
        const ultimo = [...guardados].reverse().find((x) => x.data);
        if (ultimo) {
          setPlan(ultimo.data as WeekPlan);
          setWeeks(Math.max(1, (ultimo.data as WeekPlan).weeks || 1));
        }
        // El plan guardado sigue valiendo aunque la conversación no lo traiga.
        //
        // Esto estaba en un `else`: con una conversación a medias que no
        // hubiera llegado a generar plan, el guardado no se miraba NUNCA y el
        // asesor contestaba "no tengo ningún plan previo" con el plan puesto en
        // la Agenda. La conversación manda sobre cuál enseñar; lo que no puede
        // es tapar al que existe.
        if (!ultimo && activo) {
          setPlan(activo.plan);
          setWeeks(Math.max(1, activo.plan.weeks || 1));
        }
      } else if (activo) {
        setPlan(activo.plan);
        setWeeks(Math.max(1, activo.plan.weeks || 1));
        setTurnos([{ role: 'assistant', content: t('mc_pc_resumed'), plan: activo.plan }]);
      }

      // La agenda real, en paralelo a todo lo anterior.
      void loadAgendaSnapshot(profile.id, weekStart, 3).then((a) => { if (alive) setAgenda(a); });
      void loadTrainedRecent(profile.id, 7).then((h) => { if (alive) setHistorial(h); });
      const fr = f.data as { discipline?: string; weight_class?: string; experience_level?: string; age?: number } | null;
      setFighter({
        name: (profile.full_name || '').split(' ')[0] || undefined,
        discipline: fr?.discipline, level: fr?.experience_level,
        weightClass: fr?.weight_class, age: fr?.age,
        currentWeight: (w.data as { weight_kg?: number } | null)?.weight_kg,
        targetWeight: (g.data as { target_weight_kg?: number } | null)?.target_weight_kg,
        ...(cuerpo ? contextoCuerpoParaIA(cuerpo) : {}),
      });
    })();
    return () => { alive = false; };
  }, [profile.id, profile.full_name, weekStart, t]);

  // scrollTo sobre el contenedor, no scrollIntoView sobre el final.
  //
  // scrollIntoView mueve el ancestro con scroll MÁS CERCANO, y cuando la lista
  // no tenía altura propia ese ancestro era la página: cada mensaje te bajaba
  // la pantalla entera. Con la tarjeta ya a altura fija el efecto sería aún más
  // visible. Consulta ya lo hacía así; ahora los dos igual.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turnos, enviando]);

  // Se guarda en cada cambio, no al salir: de una pantalla se sale cerrando la
  // pestaña o pulsando atrás, y ahí no hay ocasión de despedirse.
  useEffect(() => {
    if (turnos.length === 0) return;
    saveChat(profile.id, 'plan', turnos.map((x) => ({
      role: x.role, content: x.content, ...(x.plan ? { data: x.plan } : {}),
    })));
  }, [turnos, profile.id]);

  const enviar = useCallback(async (texto0?: string) => {
    const msg = (texto0 ?? texto).trim();
    // Con foto vale sin escribir: enseñarle la hoja del plan y esperar es una
    // forma normal de pedir que te lo mejore.
    if ((!msg && !foto) || enviando) return;

    const historia: PlanChatMessage[] = [
      ...turnos.map((x) => ({
        role: x.role,
        content: x.content,
        // Las fotos de turnos anteriores siguen viajando: si en el turno 1
        // mandas la hoja y en el 3 dices "cámbiame el martes", sin la foto el
        // modelo ya no sabe de qué martes le hablas.
        ...(x.image ? { image: { base64: x.image.base64, mediaType: x.image.mediaType } } : {}),
      })),
      { role: 'user' as const, content: msg, ...(foto ? { image: { base64: foto.base64, mediaType: foto.mediaType } } : {}) },
    ];
    setTurnos((p) => [...p, { role: 'user', content: msg, ...(foto ? { image: foto } : {}) }]);
    setTexto('');
    setFoto(null);
    setEnviando(true);

    // La agenda se relee AHORA, no se usa la del montaje: entre dos mensajes
    // puedes haber ido a moverla. Si falla, se manda la que hubiera.
    const [agendaAhora, histAhora] = await Promise.all([
      // Con el id del plan, la foto sabe qué bloques son suyos y se puede
      // podar lo que el propio plan ya dice (ver compactarAgenda).
      loadAgendaSnapshot(profile.id, weekStart, 3, plan?.id).catch(() => agenda),
      loadTrainedRecent(profile.id, 7).catch(() => historial),
    ]);
    setAgenda(agendaAhora);
    setHistorial(histAhora);

    // El id se conserva si ya había plan: es lo que impide que un cambio cree
    // un plan paralelo y duplique las entradas de la Agenda.
    // Los adjuntos viejos se caen si no caben TODOS. Sin esto, dos PDF que
    // van bien de uno en uno reventaban juntos, y el mensaje que fallaba era
    // uno en el que no habías adjuntado nada.
    const res = await sendPlanChat(limitarAdjuntos(historia), ctx, fighter, plan, plan?.id || `wp_${Date.now().toString(36)}`,
      // Con plan delante, la agenda solo lleva lo que el plan no puede decir:
      // lo ya entrenado y lo que se movió a mano. Lo demás viaja en el plan y
      // mandarlo dos veces se paga dos veces.
      plan ? compactarAgenda(agendaAhora) : agendaAhora,
      histAhora,
      !!plan);
    setEnviando(false);

    if (res.error) {
      // El mensaje que ha fallado NO se queda colgado en la conversación.
      //
      // Antes se quedaba puesto y sin respuesta, así que al reintentar la
      // pantalla acumulaba dos y tres mensajes tuyos seguidos sin que nadie
      // contestara: parecía que la app te ignoraba, y encima cada reintento
      // mandaba más conversación inútil.
      //
      // Vuelve al campo de escribir, con la foto si la había: así se puede
      // reintentar tal cual o cambiarle una palabra, sin volver a dictarlo.
      setTurnos((p) => p.slice(0, -1));
      setTexto(msg);
      if (foto) setFoto(foto);

      // Los códigos se traducen; cualquier otra cosa es un mensaje que ya
      // viene escrito desde el servidor y se enseña tal cual.
      const CLAVES: Record<string, string> = {
        auth: 'mc_pc_err_auth',
        too_large: 'mc_chat_too_big_send',
        timeout: 'mc_pc_err_timeout',
        server: 'mc_ai_err_generate',
        network: 'mc_ai_err_generate',
        error: 'mc_ai_err_generate',
      };
      // `server` es el cajon de "algo ha fallado y no se sabe que": ahi va el
      // codigo, que es el unico dato que permite arreglarlo despues. En los
      // demas casos el mensaje ya explica que pasa y el numero solo asusta.
      const clave = CLAVES[res.error];
      const texto = res.error === 'server' && res.status
        ? t('mc_ai_err_code', { code: res.status })
        : clave ? t(clave) : res.error;
      showToast(texto, 'error');
      return;
    }
    setTurnos((p) => [...p, { role: 'assistant', content: res.reply, ...(res.plan ? { plan: res.plan } : {}) }]);
    if (res.plan) { setPlan(res.plan); setGuardado(null); }
  }, [texto, foto, enviando, turnos, ctx, fighter, plan, agenda, historial, weekStart, profile.id, showToast, t]);

  /**
   * Manda el plan a la Agenda.
   *
   * Antes de nada mira si YA hay otro plan puesto. La limpieza al guardar solo
   * retira los bloques sellados con el MISMO id, así que un plan nuevo se
   * sumaba al viejo y los días salían duplicados: dos fuerzas el lunes, dos
   * cardios el martes. Ahora se pregunta, que es la única respuesta honesta —
   * sustituir y no sustituir son las dos cosas razonables según el caso.
   */
  const guardar = async (sustituyendo = false) => {
    if (!plan || guardando) return;

    if (!sustituyendo && activoEnAgenda && activoEnAgenda.id !== plan.id) {
      setChoque(activoEnAgenda);
      return;
    }

    setGuardando(true);
    const res = await commitWeekPlan(profile.id, plan, {
      profile: fighter as unknown as Record<string, unknown>,
      onProgress: (_paso, hechos, total) => setProgreso({ hechos, total }),
    });
    setGuardando(false);
    setProgreso(null);
    setGuardado(res);
    if (res.agendaUnavailable) { showToast(t('mc_pc_agenda_off'), 'error'); return; }
    // A partir de ahora, el de la Agenda es éste.
    setActivoEnAgenda(plan);
    showToast(t('mc_pc_saved', { n: res.agendaItems }));
  };

  /**
   * Saca el plan de la Agenda.
   *
   * Lo pendiente se va; lo YA ENTRENADO se queda siempre. Un día entrenado es
   * un hecho, no una intención: borrarlo porque cambias de plan sería reescribir
   * lo que hiciste.
   */
  const quitarPlan = async (p: WeekPlan, seguirGuardando: boolean) => {
    setQuitando(true);
    const r = await archiveWeekPlan(profile.id, p.id);
    setQuitando(false);
    setChoque(null);
    setActivoEnAgenda(null);
    showToast(t('mc_pc_removed', { n: r.removed }));
    if (r.keptCompleted.length > 0) showToast(t('mc_pc_removed_kept', { n: r.keptCompleted.length }));
    if (seguirGuardando) await guardar(true);
  };

  const sinIA = aiOk === false;

  // Las dos tarjetas de abajo son excluyentes: o el plan está listo para
  // mandar, o ya está mandado. Nunca las dos.
  const hayLateral = !!plan || !!guardado;

  return (
    // En monitor: conversación a la izquierda y el plan al lado, pero SOLO
    // cuando hay plan. Partir en dos con la columna derecha vacía dejaría un
    // hueco de 360 px sin nada, que es peor que no partir.
    //
    // En móvil ninguna de las dos clases hace nada: la rejilla vive dentro de
    // una consulta de 1280 px para arriba.
    <div className={`rk-blocks ${hayLateral ? 'rk-ai-split' : 'max-w-3xl xl:max-w-none'}`}>
      {/* ── La conversación ── */}
      {/* Altura fija y columna, como Consulta.
          Antes la lista crecía hasta 58vh y la caja de escribir bajaba con
          ella: escribías en un sitio distinto según lo larga que fuera la
          conversación. Con altura fija, el campo está SIEMPRE donde lo dejaste,
          que es como se comporta cualquier chat. */}
      <div className="rk-card overflow-hidden flex flex-col rk-ai-h" style={{ padding: 0 }}>
        {/* Cabecera.
            No la tenía: el chat empezaba en un cuadro de texto suelto y no se
            sabía con qué estabas hablando. La misma que Consulta a propósito —
            son dos conversaciones de lo mismo y tienen que parecerlo. */}
        <div className="px-4 sm:px-5 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl rk-ai-avatar">
            <i className="ri-calendar-todo-line text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white truncate">{t('mc_pc_head_title')}</h3>
            <p className="text-xs flex items-center gap-1.5 truncate" style={{ color: 'var(--t-3)' }}>
              <span className="w-1.5 h-1.5 rounded-full rk-alive flex-shrink-0" style={{ background: '#4ade80', color: '#4ade80' }} />
              {t('mc_pc_head_sub')}
            </p>
          </div>
          {/* Quitar el plan que hay puesto. Aquí y no escondido en un menú:
              cambiar de plan es una cosa normal, y sin esto la única salida era
              borrar los bloques uno a uno desde la Agenda. */}
          {activoEnAgenda && (
            <button onClick={() => setChoque(activoEnAgenda)}
              title={t('mc_pc_remove_plan')}
              aria-label={t('mc_pc_remove_plan')}
              className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer">
              <i className="ri-delete-bin-line" />
            </button>
          )}
          {turnos.length > 0 && (
            <button onClick={() => {
              // Se borra también el plan en curso: dejarlo colgando de una
              // conversación que ya no existe confunde más que ayudar. Lo que
              // se guardó en la Agenda no se toca — eso ya está a salvo.
              setTurnos([]); setPlan(null); setGuardado(null);
              clearChat(profile.id, 'plan');
            }}
              title={t('mc_pc_new_chat')}
              className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
              <i className="ri-refresh-line" />
            </button>
          )}
        </div>

        <div className="rk-chat-wrap flex-1 min-h-0">
        <div ref={scrollRef} className={`h-full overflow-y-auto space-y-5 px-4 sm:px-6 py-5 ${turnos.length > 0 ? 'rk-chat-abajo' : ''}`}>
          {turnos.length === 0 && (
            <div className="py-6 text-center anim-scale-in">
              <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl rk-ai-avatar">
                <i className="ri-calendar-todo-line text-2xl" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('mc_pc_welcome')}</p>
              <p className="text-sm mt-2 leading-relaxed max-w-md mx-auto" style={{ color: 'var(--t-2)' }}>{t('mc_pc_intro')}</p>
              {/* Las sugerencias como tarjetas y no como pastillas: son frases
                  largas, y en pastilla se parten en dos líneas y quedan rotas. */}
              <div className="grid gap-2 mt-6 max-w-md mx-auto">
                {[
                  { icon: 'ri-focus-3-line', s: t('mc_pc_sug_1') },
                  { icon: 'ri-sun-line', s: t('mc_pc_sug_2') },
                  { icon: 'ri-fire-line', s: t('mc_pc_sug_3') },
                ].map(({ icon, s }) => (
                  <button key={s} onClick={() => enviar(s)} disabled={enviando || sinIA}
                    className="rk-chip rk-quick-tile !flex-row !items-center !gap-3 !p-3 disabled:opacity-50">
                    <i className={`${icon} text-lg flex-shrink-0`} style={{ color: '#C4B5FD' }} />
                    <span className="min-w-0 text-sm leading-snug" style={{ color: 'var(--t-1)' }}>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {turnos.map((x, i) => {
            const mio = x.role === 'user';
            // El avatar solo en el PRIMER mensaje de una tanda suya: repetirlo en
            // cada burbuja llena la columna de iconos y parece que hablan varios.
            const abre = !mio && (i === 0 || turnos[i - 1].role === 'user');
            return (
            <div key={i}>
              <div className={`flex items-start gap-3 ${mio ? 'justify-end' : 'justify-start'} ${mio ? 'rk-msg-mine' : 'rk-msg-yours'}`}>
                {!mio && (
                  <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${abre ? 'rk-ai-avatar' : 'opacity-0'}`}>
                    <i className="ri-sparkling-2-fill text-sm" />
                  </div>
                )}
                {/* v4: la respuesta, sin globo y a todo lo ancho (ver .rk-bubble-theirs). */}
                <div className={`text-[15px] leading-relaxed whitespace-pre-wrap ${mio
                  ? 'max-w-[82%] rk-bubble-mine rounded-2xl rounded-tr-md px-4 py-2.5'
                  : 'flex-1 min-w-0 rk-ai-burbuja rk-bubble-theirs pt-1'}`}>
                  {x.image && (
                    x.image.esPdf
                      ? <span className="flex items-center gap-2 mb-1.5 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.22)' }}>
                          <i className="ri-file-pdf-line text-lg" />
                          <span className="text-xs font-semibold truncate">{x.image.nombre || 'PDF'}</span>
                        </span>
                      : <img src={x.image.previewUrl} alt=""
                          className="rounded-xl mb-1.5 max-h-52 w-auto" style={{ maxWidth: '100%' }} />
                  )}
                  {x.content}
                </div>
              </div>
              {/* El plan, como un mensaje más y en su sitio de la conversación. */}
              {x.plan && (
                <Reveal>
                  <PlanCard plan={x.plan} vigente={plan?.id === x.plan.id && x.plan === plan} />
                </Reveal>
              )}
            </div>
            );
          })}

          {enviando && (
            <div className="flex items-start gap-3 justify-start rk-msg-yours">
              <div className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center rk-ai-avatar">
                <i className="ri-sparkling-2-fill text-sm" />
              </div>
              <div className="pt-2 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-zinc-400">{t('mc_pc_thinking')}</span>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* ── Escribir ──
            En DOS filas, no en una.
            El botón de dictar CAMBIA DE TAMAÑO mientras hablas: se convierte en
            un botón ancho de "grabando" y saca debajo lo que va oyendo. Metido
            en la misma fila que el texto y el enviar, en un móvil eso aplasta la
            caja de escribir cada vez que abres la boca. Abajo y con la fila para
            él solo, puede crecer sin empujar nada.
            fontSize 16 no es un capricho de diseño: por debajo de 16px, Safari
            de iPhone AMPLÍA la página entera al tocar el campo. */}
        <div className="px-3 sm:px-4 pt-2 pb-3 flex-shrink-0">
          {/* v4: una sola caja, como en Consulta. El texto crece al escribir. */}
          <div className="rk-composer">
            {foto && <div className="px-3 pt-3"><FotoPendiente foto={foto} onQuitar={() => setFoto(null)} /></div>}
            <textarea ref={areaRef} value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} maxLength={2000}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder={t('mc_pc_ph')} disabled={sinIA}
              className="w-full text-white px-4 pt-3 pb-1 disabled:opacity-50 block"
              style={{ fontSize: 16, lineHeight: 1.5, maxHeight: 180 }} />
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <div className="flex items-center gap-1 min-w-0">
                <PhotoAttach foto={foto} onFoto={setFoto} disabled={enviando || sinIA}
                  onError={(m) => showToast(m, 'error')} />
                <VoiceButton onResult={(s) => setTexto((p) => (p ? `${p} ${s}` : s))} />
              </div>
              <button onClick={() => enviar()} disabled={enviando || (!texto.trim() && !foto) || sinIA}
                aria-label={t('mc_pc_send_btn')} className="rk-send">
                <i className="ri-arrow-up-line" />
              </button>
            </div>
          </div>
        </div>
        {sinIA && <p className="text-[11px] text-[#C9A84C] px-4 pb-4 -mt-2 leading-relaxed">{t('mc_pc_no_ai')}</p>}
      </div>

      {/* ── Mandarlo a la app ──
          Fijo abajo y no dentro de un mensaje: el plan cambia con cada turno y
          el botón tiene que referirse SIEMPRE al último, no a una versión que
          quedó a mitad de la conversación. */}
      {plan && !guardado && (
        <div className="rk-card rk-ai-side" style={{ padding: 16, borderColor: 'rgba(225,6,0,0.35)' }}>
          {/* Lo que va a pasar al pulsar, en números.
              "Se manda a la agenda" no dice cuánto es: con los tres datos
              delante se ve si el plan es el que querías ANTES de meterlo, que
              es cuando sale barato cambiar de idea. */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl rk-ai-avatar">
              <i className="ri-calendar-check-line text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{t('mc_pc_ready_title')}</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t('mc_pc_ready_desc')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {(() => {
              const st = planTotals(plan);
              return [
                { icon: 'ri-calendar-2-line', hex: '#a1a1aa', txt: plan.weeks > 1 ? t('mc_pc_weeks_n', { n: plan.weeks }) : t('mc_pc_weeks_1') },
                { icon: 'ri-hammer-line', hex: '#fb923c', txt: t('mc_pc_stat_strength', { n: st.strengthDays }) },
                ...(st.cardioSlots > 0 ? [{ icon: 'ri-heart-pulse-line', hex: '#4ade80', txt: t('mc_pc_stat_cardio', { n: st.cardioSlots }) }] : []),
                ...(st.meals > 0 ? [{ icon: 'ri-restaurant-line', hex: '#38bdf8', txt: t('mc_pc_stat_meals', { n: st.meals }) }] : []),
              ].map(({ icon, hex, txt }) => (
                <span key={txt} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200 rounded-lg px-2 py-1"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <i className={icon} style={{ color: hex }} />{txt}
                </span>
              ));
            })()}
          </div>

          <button onClick={() => guardar()} disabled={guardando}
            className="rk-cta rk-press w-full flex items-center justify-center gap-2 mt-3 disabled:opacity-60"
            style={{ minHeight: 48 }}>
            {guardando
              ? <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {/* Decir QUÉ está tardando. Guardar es instantáneo; lo que tarda
                    es escribir el guion de cada cardio, y una rueda muda diez
                    segundos parece que se ha colgado. */}
                {progreso && progreso.total > 0
                  ? t('mc_pc_saving_cardio', { n: progreso.hechos + 1, total: progreso.total })
                  : t('mc_saving')}
              </>
              : <><i className="ri-calendar-check-line text-lg" /> {t('mc_pc_send')}</>}
          </button>
        </div>
      )}

      {/* ── Ya hay un plan puesto: ¿qué hago con él? ──
          Las dos salidas son razonables según el caso, así que se preguntan las
          dos en vez de decidir por él. Y la tercera —no hacer nada— también
          tiene que estar: cerrar la hoja no guarda ni borra. */}
      <BottomSheet open={!!choque} onClose={() => { if (!quitando && !guardando) setChoque(null); }}
        title={t('mc_pc_clash_title')}>
        {choque && (
          <>
            <div className="rk-card mb-4" style={{ padding: 14 }}>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--t-3)' }}>
                {t('mc_pc_clash_current')}
              </p>
              <p className="text-sm font-bold text-white mt-1">{choque.summary || t('mc_pc_plan_current')}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {choque.weeks > 1 ? t('mc_pc_weeks_n', { n: choque.weeks }) : t('mc_pc_weeks_1')}
                {' · '}{t('mc_pc_stat_strength', { n: choque.strength.length })}
              </p>
            </div>

            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--t-2)' }}>
              {t('mc_pc_clash_desc')}
            </p>

            {/* Sustituir Y guardar el nuevo, que es lo que se viene a hacer
                cuando llegas aquí desde el botón de mandar a la Agenda. */}
            {plan && plan.id !== choque.id && (
              <button onClick={() => quitarPlan(choque, true)} disabled={quitando || guardando}
                className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ minHeight: 48 }}>
                {(quitando || guardando)
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><i className="ri-loop-left-line" /> {t('mc_pc_clash_replace')}</>}
              </button>
            )}

            {/* Solo quitarlo, sin poner nada. Es lo que se hace desde la papelera. */}
            <button onClick={() => quitarPlan(choque, false)} disabled={quitando || guardando}
              className={`rk-btn w-full flex items-center justify-center gap-2 disabled:opacity-60 ${plan && plan.id !== choque.id ? 'mt-2' : ''}`}
              style={{ minHeight: 48 }}>
              <i className="ri-delete-bin-line" /> {t('mc_pc_clash_remove_only')}
            </button>

            {plan && plan.id !== choque.id && (
              <button onClick={() => { setChoque(null); void guardar(true); }} disabled={quitando || guardando}
                className="w-full text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer mt-3 disabled:opacity-60"
                style={{ minHeight: 40 }}>
                {t('mc_pc_clash_keep_both')}
              </button>
            )}

            <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed flex items-start gap-1.5">
              <i className="ri-information-line mt-0.5 flex-shrink-0" />{t('mc_pc_clash_note')}
            </p>
          </>
        )}
      </BottomSheet>

      {guardado && (
        <div className="rk-card rk-ai-side" style={{ padding: 16, borderColor: 'rgba(74,222,128,0.35)' }}>
          {/* El check con su aro verde, no un icono suelto en una línea.
              Guardar el plan es el final del camino: se nota o no se nota. */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
              <i className="ri-check-double-line text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: '#4ade80' }}>
                {t('mc_pc_done_title')}
              </p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {t('mc_pc_done_desc', { n: guardado.agendaItems })}
                {guardado.keptCompleted.length > 0 && ` ${t('mc_pc_done_kept', { n: guardado.keptCompleted.length })}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {onGoAgenda && (
              <button onClick={onGoAgenda} className="rk-nav-btn rk-press text-xs flex-1" style={{ minHeight: 44 }}>
                <i className="ri-calendar-line mr-1" />{t('mc_pc_go_agenda')}
              </button>
            )}
            <button onClick={() => setGuardado(null)} className="rk-nav-btn rk-press text-xs flex-1" style={{ minHeight: 44 }}>
              <i className="ri-chat-1-line mr-1" />{t('mc_pc_keep_talking')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── La tabla del plan, dentro del chat ──────────────────────────

/**
 * El plan en una tabla por días.
 *
 * Se agrupa por DÍA y no por tipo (toda la fuerza junta, todo el cardio junto)
 * porque lo que se quiere comprobar de un vistazo es "qué hago el martes", no
 * "cuántos cardios hay". Con el reparto por días también se ve solo si un día
 * está cargado de más.
 */
/**
 * "5 tramos · 12% máx · 4-5 km/h" — la tabla de un cardio, en una línea.
 *
 * Cuando le pasas un documento con tu tabla y le dices "tal cual", esto es lo
 * único que te deja comprobar de un vistazo que ha copiado la tuya y no se ha
 * inventado otra. Sin esto, el plan solo dice "cinta · 45 min", que es
 * exactamente lo mismo que decía cuando SÍ se la inventaba.
 */
function resumenTramos(segments: ProtocolSegment[], t: (k: string, o?: Record<string, unknown>) => string): string {
  const partes: string[] = [t('mc_pc_segs', { n: segments.length })];
  const num = (k: 'speed_kmh' | 'incline_pct') => segments
    .map((s) => s.values?.[k])
    .filter((v): v is number => typeof v === 'number' && v > 0);

  const inc = num('incline_pct');
  if (inc.length) partes.push(t('mc_pc_incline_max', { n: Math.max(...inc) }));

  const vel = num('speed_kmh');
  if (vel.length) {
    const lo = Math.min(...vel), hi = Math.max(...vel);
    partes.push(lo === hi ? `${lo} km/h` : `${lo}-${hi} km/h`);
  }
  return partes.join(' · ');
}
function PlanCard({ plan, vigente }: { plan: WeekPlan; vigente: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const total = Math.max(1, plan.weeks || 1);
  const stats = planTotals(plan);

  // Se pinta la PRIMERA semana: con "se repite salvo lo que cambie", enseñar
  // las seis enteras sería scroll de relleno. Lo que difiera se dice aparte.
  const dias = Array.from({ length: 7 }, (_, d) => {
    const fuerza = plan.strength.filter((s) => s.weekday === d && weeksOf(total, s.week).includes(0));
    const cardio = plan.protocols.filter((p) => p.weekdays.includes(d) && weeksOf(total, p.weeks).includes(0));
    const comidas = plan.nutrition.filter((n) => n.weekday === d && weeksOf(total, n.week).includes(0));
    return { d, fuerza, cardio, comidas };
  }).filter((x) => x.fuerza.length || x.cardio.length || x.comidas.length);

  // Los que se guardan sin fecha, para que no se los trague la tabla.
  const sinDia = plan.protocols.filter((p) => (p.weekdays || []).length === 0);

  return (
    <div className="rounded-2xl border mt-2 overflow-hidden"
      style={{
        borderColor: vigente ? 'rgba(225,6,0,0.35)' : 'rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.02)',
        // El plan vigente se despega del chat con un halo propio. Los anteriores
        // se quedan planos: siguen ahí para ver qué contestaba a qué, pero no
        // deben competir por la mirada con el que cuenta.
        boxShadow: vigente ? '0 10px 30px -18px rgba(225,6,0,0.9)' : 'none',
      }}>
      <div className="px-3.5 py-3" style={{ borderBottom: '1px solid var(--s-3)' }}>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-1.5"
          style={{ color: vigente ? 'var(--accent)' : 'var(--t-3)' }}>
          {vigente && <i className="ri-checkbox-circle-fill" />}
          {vigente ? t('mc_pc_plan_current') : t('mc_pc_plan_old')}
        </p>
        {/* Los números en pastillas y no en una línea separada por puntos: de un
            vistazo se ve CUÁNTO hay de cada cosa, que es lo que se mira al leer
            un plan por encima. En una sola línea gris no se lee nada. */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { icon: 'ri-calendar-2-line', hex: '#a1a1aa', txt: total > 1 ? t('mc_pc_weeks_n', { n: total }) : t('mc_pc_weeks_1') },
            { icon: 'ri-hammer-line', hex: '#fb923c', txt: t('mc_pc_stat_strength', { n: stats.strengthDays }) },
            ...(stats.cardioSlots > 0 ? [{ icon: 'ri-heart-pulse-line', hex: '#4ade80', txt: t('mc_pc_stat_cardio', { n: stats.cardioSlots }) }] : []),
            ...(stats.meals > 0 ? [{ icon: 'ri-restaurant-line', hex: '#38bdf8', txt: t('mc_pc_stat_meals', { n: stats.meals }) }] : []),
          ].map(({ icon, hex, txt }) => (
            <span key={txt} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200 rounded-lg px-2 py-1"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <i className={icon} style={{ color: hex }} />{txt}
            </span>
          ))}
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--s-3)' }}>
        {dias.map(({ d, fuerza, cardio, comidas }) => (
          <div key={d} className="px-3.5 py-3">
            {/* El día como etiqueta con su punto, no como un renglón gris más.
                Es la única referencia para orientarse dentro de la tabla. */}
            <p className="text-[11px] font-bold uppercase tracking-wider capitalize flex items-center gap-1.5 text-zinc-400">
              <span className="w-1 h-3.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)', opacity: 0.55 }} />
              {etiquetaDia(plan, d, locale)}
            </p>

            <div className="mt-2 space-y-2 pl-3">
              {fuerza.map((s, i) => (
                <div key={`f${i}`} className="flex gap-2.5">
                  <i className="ri-hammer-line text-sm mt-0.5 flex-shrink-0" style={{ color: '#fb923c' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white leading-snug">{s.name || s.groups.join(' + ')}</p>
                    {s.exercises.length > 0 && (
                      <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">
                        {s.exercises.slice(0, 6).map((e) => `${e.name} ${fmtSetCount(e.sets, e, t)}`).join(' · ')}
                        {s.exercises.length > 6 && ` +${s.exercises.length - 6}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {cardio.map((p, i) => {
                const cfg = activityKindCfg(p.kind);
                // Los minutos salen de los TRAMOS si los hay y, si no, de
                // `minutes`. Un cardio montado hablando no trae tramos —su
                // esquema no tiene sitio para ellos— así que sumando solo los
                // tramos daba 0 siempre y la duración no se veía nunca, que es
                // justo el dato por el que se mira un cardio.
                const min = p.segments.length > 0
                  ? Math.round(p.segments.reduce((a, s) => a + (s.seconds || 0), 0) / 60)
                  : (p.minutes || 0);
                return (
                  <div key={`c${i}`} className="flex gap-2.5">
                    <i className={`${cfg.icon} text-sm mt-0.5 flex-shrink-0`} style={{ color: p.optional ? 'var(--t-3)' : cfg.hex }} />
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold leading-snug flex items-center gap-1.5 flex-wrap ${p.optional ? 'text-zinc-400' : 'text-white'}`}>
                        {p.name || t(cfg.labelKey)}
                        {min > 0 && <span className="text-zinc-500 font-normal">· {min} min</span>}
                        {/* Opcional se dice AQUI tambien, no solo en la Agenda: si
                            no, al revisar el plan parece que te ha metido cinco
                            cardios obligatorios y lo primero que haces es borrarlos. */}
                        {p.optional && (
                          <span className="text-[9px] font-bold uppercase tracking-wider rounded px-1 py-0.5"
                            style={{ color: 'var(--t-3)', background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
                            {t('mc_ag_optional')}
                          </span>
                        )}
                      </p>
                      {/* Si trae TU tabla, se resume aqui: es la unica forma de
                          comprobar de un vistazo que ha copiado la del archivo y
                          no se ha inventado otra. */}
                      {p.segments.length > 0 && <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--t-3)' }}>{resumenTramos(p.segments, t)}</p>}
                      {p.note && <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{p.note}</p>}
                    </div>
                  </div>
                );
              })}

              {comidas.map((n, i) => (
                <div key={`m${i}`} className="flex gap-2.5">
                  <i className="ri-restaurant-line text-sm mt-0.5 flex-shrink-0" style={{ color: '#38bdf8' }} />
                  <p className="text-[11px] text-zinc-400 leading-snug min-w-0">
                    {n.meals.map((m) => `${t(`mc_dp_slot_${m.slot}`, { defaultValue: m.slot })}: ${m.text}`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── LOS QUE NO TIENEN DÍA ──

          Sin esto DESAPARECÍAN del plan: la lista de arriba recorre los siete
          días, así que un cardio con `weekdays` vacío no salía por ningún
          lado. Y las pastillas de arriba sí lo contaban, o sea que el plan
          decía "3 cardios" y solo se veían dos. Perfecto para pensar que se ha
          perdido algo. */}
      {sinDia.length > 0 && (
        <div className="px-3.5 py-3" style={{ borderTop: '1px solid var(--s-3)' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--t-3)' }}>
            <i className="ri-bookmark-line" />{t('mc_pc_no_day')}
          </p>
          <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--t-3)' }}>{t('mc_pc_no_day_sub')}</p>
          <div className="mt-2 space-y-2 pl-3">
            {sinDia.map((p, i) => {
              const cfg = activityKindCfg(p.kind);
              const min = p.segments.length > 0
                ? Math.round(p.segments.reduce((a, s) => a + (s.seconds || 0), 0) / 60)
                : (p.minutes || 0);
              return (
                <div key={`s${i}`} className="flex gap-2.5">
                  <i className={`${cfg.icon} text-sm mt-0.5 flex-shrink-0`} style={{ color: 'var(--t-3)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-400 leading-snug">
                      {p.name || t(cfg.labelKey)}
                      {min > 0 && <span className="text-zinc-500 font-normal"> · {min} min</span>}
                    </p>
                    {p.segments.length > 0 && <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--t-3)' }}>{resumenTramos(p.segments, t)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plan.disclaimer && (
        <p className="px-3.5 py-2 text-[10px] text-zinc-600 leading-relaxed" style={{ borderTop: '1px solid var(--s-3)' }}>
          {plan.disclaimer}
        </p>
      )}
    </div>
  );
}


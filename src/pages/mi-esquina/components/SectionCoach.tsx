import { useState, useEffect, useRef, useCallback } from 'react';
import { sendPlanChat } from '@/services/planChat';
import { commitWeekPlan, loadActivePlan } from '@/pages/mi-esquina/lib/weekPlan';
import { ACTIVITY_KINDS, todayISO } from '@/pages/mi-esquina/lib/dayPlan';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import { clearChat, loadChat, saveChat } from '@/pages/mi-esquina/lib/chatHistory';
import VoiceButton from '@/components/feature/VoiceButton';
import PhotoAttach, { FotoPendiente } from './PhotoAttach';
import { limitarAdjuntos, type ImagenLista } from '@/lib/imageInput';
import { compactarAgenda, loadAgendaSnapshot, loadTrainedRecent, type AgendaDia, type DiaEntrenado } from '@/pages/mi-esquina/lib/agendaSnapshot';
import { libraryLabels } from '@/pages/mi-esquina/lib/exercises';
import { currentWeekStart } from '@/pages/mi-esquina/lib/weekPlan';

// 'general' es la CONSULTA ABIERTA (punto 18): cualquier duda, sin flujo. Los
// otros tres están acotados a su ámbito y se derivan entre ellos; este no.
type Section = 'training' | 'nutrition' | 'gear' | 'general';
type Accent = 'red' | 'gold' | 'sky';

interface Props {
  section: Section;
  profile: Profile;
  title: string;
  intro: string;
  suggestions: string[];
  accent?: Accent;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  /**
   * Foto adjunta, si la hay. Solo en mensajes del usuario.
   *
   * No se guarda en el historial de localStorage a propósito: una foto ocupa
   * cientos de KB y el almacenamiento del navegador son unos pocos MB. Tres
   * fotos lo llenarían y se perderían TODAS las conversaciones, que es mucho
   * peor que perder la miniatura de una foto ya mandada.
   */
  image?: ImagenLista;
}

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};
const levelLabels: Record<string, string> = {
  amateur: 'Amateur', semi_pro: 'Semi-profesional', professional: 'Profesional',
};

const ACCENTS: Record<Accent, { text: string; bg: string; border: string; ring: string; dot: string; spin: string }> = {
  red: { text: 'text-red-400', bg: 'bg-red-600/12', border: 'border-red-500/30', ring: 'focus:border-red-500', dot: '#E10600', spin: 'border-red-500' },
  gold: { text: 'text-[#C9A84C]', bg: 'bg-[#C9A84C]/12', border: 'border-[#C9A84C]/35', ring: 'focus:border-[#C9A84C]', dot: '#C9A84C', spin: 'border-[#C9A84C]' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/12', border: 'border-sky-500/30', ring: 'focus:border-sky-500', dot: '#38bdf8', spin: 'border-sky-500' },
};

function isoFromOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + (Number.isFinite(offset) ? offset : 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Dos marcadores conviven en el texto de la IA:
//  - [VIDEO: nombre]        → Coach de Entrenamiento: botón a búsqueda de YouTube.
//    Usamos búsqueda (no una URL concreta) para que el enlace SIEMPRE sea válido.
//  - [texto](https://...)   → Asesor de Material: enlace real de compra que sale
//    de la búsqueda web. Se limita a http/https para no colar esquemas raros.
const INLINE_RE = /\[VIDEO:\s*([^\]]+)\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;

/**
 * El marcador de cambio de plan que puede dejar el asesor.
 *
 * Es el mismo truco que [VIDEO: …]: un marcador que NO se enseña y que
 * enciende una acción. Aquí enciende el botón de aplicar el cambio a la
 * agenda — la diferencia entre "deberías mover el jueves" y que el jueves se
 * mueva de verdad.
 */
const CAMBIO_RE = /\[CAMBIO:\s*([^\]]+)\]/i;

/** La instrucción del último mensaje del asesor, si la hay. */
function cambioPropuesto(texto) {
  const m = texto.match(CAMBIO_RE);
  return m ? m[1].trim() : null;
}

/** El texto sin el marcador, que es como se enseña. */
function sinMarcadorCambio(texto) {
  return texto.replace(CAMBIO_RE, '').trimEnd();
}

function youtubeSearch(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim() + ' técnica tutorial')}`;
}

// Renderiza negritas (**texto**) dentro de un fragmento de texto.
function renderBold(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
    seg.startsWith('**') && seg.endsWith('**')
      ? <strong key={`${keyBase}-b${j}`} className="text-white font-semibold">{seg.slice(2, -2)}</strong>
      : <span key={`${keyBase}-s${j}`}>{seg}</span>
  );
}

// Renderiza una línea: negritas + los marcadores [VIDEO: ...] y los enlaces
// markdown [texto](url) como botones/enlaces pinchables.
function renderInline(text: string, keyBase: string, watchLabel: string) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderBold(text.slice(last, m.index), `${keyBase}-t${idx}`));
    if (m[1] !== undefined) {
      // Vídeo de apoyo → búsqueda de YouTube
      const q = m[1].trim();
      nodes.push(
        <a key={`${keyBase}-v${idx}`} href={youtubeSearch(q)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 align-middle mx-0.5 my-0.5 rounded-lg bg-red-600/12 border border-red-500/35 text-red-300 hover:bg-red-600/20 hover:text-red-200 transition-colors px-2 py-0.5 text-xs font-semibold no-underline">
          <i className="ri-play-circle-fill"></i>{watchLabel} {q}
        </a>
      );
    } else {
      // Enlace real de compra (asesor de Material)
      const label = m[2].trim();
      const url = m[3].trim();
      nodes.push(
        <a key={`${keyBase}-lnk${idx}`} href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 align-middle mx-0.5 my-0.5 rounded-lg bg-white/[0.06] border border-white/15 text-sky-300 hover:text-sky-200 hover:border-white/30 transition-colors px-2 py-0.5 text-xs font-semibold no-underline">
          <i className="ri-external-link-line"></i>{label}
        </a>
      );
    }
    last = m.index + m[0].length;
    idx++;
  }
  if (last < text.length) nodes.push(...renderBold(text.slice(last), `${keyBase}-t${idx}`));
  return nodes;
}

// Formateo ligero del markdown que devuelve la IA (negritas, listas, saltos, vídeos).
function renderRich(text: string, watchLabel: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();

    // ── Lista numerada ("1. …", "2) …") ──
    //
    // Salía como texto plano, con el número pegado a la frase. Y desde que el
    // prompt pide respuestas densas y con pasos, es lo que más devuelve: una
    // receta de cinco pasos se leía como un párrafo corrido. El número en su
    // chapa se cuenta de un vistazo, que es para lo que está numerado.
    const num = trimmed.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (num) {
      return (
        <div key={i} className="flex gap-2.5 items-start mt-1.5">
          <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold text-white mt-0.5"
            style={{ background: 'rgba(225,6,0,0.22)' }}>{num[1]}</span>
          <span className="min-w-0">{renderInline(num[2], `l${i}`, watchLabel)}</span>
        </div>
      );
    }

    const bullet = /^[-*•]\s+/.test(trimmed);
    const clean = bullet ? trimmed.replace(/^[-*•]\s+/, '') : line;
    const parts = renderInline(clean, `l${i}`, watchLabel);
    if (bullet) {
      return (
        <div key={i} className="flex gap-2 pl-1">
          <span className="flex-shrink-0 mt-[7px] rounded-full"
            style={{ width: 4, height: 4, background: 'var(--accent)', opacity: 0.7 }} />
          <span className="min-w-0">{parts}</span>
        </div>
      );
    }
    if (trimmed === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{parts}</div>;
  });
}

export default function SectionCoach({ section, profile, title, intro, suggestions, accent = 'red', showToast }: Props) {
  const { t, i18n } = useTranslation();
  const a = ACCENTS[accent];
  const canSavePlan = section === 'training' || section === 'nutrition';
  const [physical, setPhysical] = useState<Record<string, unknown>>({});
  /**
   * Lo que tiene puesto estos días.
   *
   * Consulta preguntaba a ciegas: "¿qué ceno hoy?" sin saber si hoy le toca
   * pierna o descanso, y "¿me da tiempo a correr?" sin saber que mañana tiene
   * sesión doble. Son las dos preguntas que más se hacen y las dos cambian de
   * respuesta según lo que haya en la agenda.
   */
  const [agenda, setAgenda] = useState<AgendaDia[]>([]);
  /** Lo entrenado de verdad: evita el "no has hecho cardio" a quien lo hizo. */
  const [historial, setHistorial] = useState<DiaEntrenado[]>([]);
  /** Cambio que el asesor propone aplicar al plan, si lo ha propuesto. */
  const [cambioDescartado, setCambioDescartado] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>(
    () => loadChat(profile.id, section).map((x) => ({ role: x.role, content: x.content })) as ChatMsg[],
  );
  useEffect(() => {
    let vivo = true;
    // Una sola semana, no tres como en el chat del plan: aquí se pregunta por
    // hoy y por mañana, no se reprograma el mes. Mandar tres semanas sería
    // pagar tokens en cada mensaje por algo que no se usa.
    loadAgendaSnapshot(profile.id, currentWeekStart(), 1)
      .then((a) => { if (vivo) setAgenda(a); })
      .catch(() => { /* sin agenda se responde igual, solo con menos contexto */ });
    loadTrainedRecent(profile.id, 7)
      .then((h) => { if (vivo) setHistorial(h); })
      .catch(() => { /* igual: es contexto, no un requisito */ });
    return () => { vivo = false; };
  }, [profile.id]);

  const [input, setInput] = useState('');
  const [foto, setFoto] = useState<ImagenLista | null>(null);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  // El asesor de Material puede buscar en la web: mientras busca (aún sin texto)
  // mostramos un aviso honesto de que está consultando precios reales.
  const [searching, setSearching] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  // El peleador puede descartar la propuesta de añadir el plan: es opcional.
  const [dismissedPlan, setDismissedPlan] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [checking, setChecking] = useState(true);
  // Cuota de IA del mes: la devuelve el servidor al final de cada respuesta
  const [quota, setQuota] = useState<{ used: number; quota: number; warnAtPct: number } | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState<{ title: string; desc: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Disponibilidad al abrir: muestra "próximamente" de entrada en vez de
  // esperar a que el usuario escriba y se tope con un fallo.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/coach', { method: 'GET' });
        const data = res.ok ? await res.json() : { available: false };
        if (alive) setNotConfigured(!data?.available);
      } catch {
        if (alive) setNotConfigured(true);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Perfil físico del peleador = contexto de la IA
  useEffect(() => {
    const load = async () => {
      // Objetivos y check-ins importan al Coach de Entrenamiento y a la consulta
      // abierta: son los que permiten contestar "¿qué hago hoy?" sabiendo cómo
      // llega el peleador esta semana. Sus tablas pueden no existir aún
      // (migración pendiente): si fallan, se ignoran.
      const wantsContext = section === 'training' || section === 'general';
      const goalsQ = wantsContext
        ? supabase.from('fighter_goals').select('title, category, target_value, unit, deadline').eq('fighter_profile_id', profile.id).eq('status', 'active')
        : Promise.resolve({ data: null });
      const checkinQ = wantsContext
        ? supabase.from('daily_checkins').select('entry_date, energy, soreness, sleep_hours')
            .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(7)
        : Promise.resolve({ data: null });

      const [{ data: f }, { data: w }, { data: g }, { data: sess }, goalRes, checkRes] = await Promise.all([
        supabase.from('fighters').select('discipline, weight_class, experience_level, age, wins, losses, draws, kos, looking_for').eq('profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('weight_kg').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
        supabase.from('training_sessions').select('duration_min, session_date').eq('fighter_profile_id', profile.id).order('session_date', { ascending: false }).limit(30),
        goalsQ,
        checkinQ,
      ]);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1)));
      weekStart.setHours(0, 0, 0, 0);
      const weeklyMinutes = (sess || [])
        .filter((s) => new Date(s.session_date + 'T12:00:00') >= weekStart)
        .reduce((acc, s) => acc + (s.duration_min || 0), 0);
      const goals = (f?.looking_for || []) as string[];

      // Metas con fecha → texto legible para la IA
      const dated = ((goalRes?.data as { title: string; category: string; target_value: number | null; unit: string | null; deadline: string | null }[] | null) || [])
        .map((gg) => {
          const target = gg.target_value !== null ? `${gg.target_value}${gg.unit || ''}` : null;
          const base = gg.category === 'weight' && target ? `llegar a ${target}` : gg.title;
          return gg.deadline ? `${base} (antes del ${gg.deadline})` : base;
        });

      // Check-ins recientes → cómo llega el peleador esta semana. Es lo que
      // permite a la IA subir o bajar la carga en vez de dar un plan genérico.
      const checks = ((checkRes?.data as { entry_date: string; energy: number; soreness: number; sleep_hours: number | null }[] | null) || []);
      let recovery: string | undefined;
      if (checks.length) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const energy = avg(checks.map((c) => c.energy));
        const soreness = avg(checks.map((c) => c.soreness));
        const sleepRows = checks.filter((c) => c.sleep_hours !== null);
        const sleep = sleepRows.length ? avg(sleepRows.map((c) => c.sleep_hours as number)) : null;
        recovery = `energía media ${energy.toFixed(1)}/5, cansancio muscular ${soreness.toFixed(1)}/5`
          + (sleep !== null ? `, sueño medio ${sleep.toFixed(1)} h` : '')
          + ` (${checks.length} check-ins recientes)`;
      }

      setPhysical({
        name: (profile.full_name || '').split(' ')[0] || undefined,
        discipline: f?.discipline ? (disciplineLabels[f.discipline] || f.discipline) : undefined,
        level: f?.experience_level ? (levelLabels[f.experience_level] || f.experience_level) : undefined,
        weightClass: f?.weight_class || undefined,
        age: f?.age || undefined,
        currentWeight: (w as { weight_kg?: number } | null)?.weight_kg || undefined,
        targetWeight: (g as { target_weight_kg?: number } | null)?.target_weight_kg || undefined,
        record: f ? `${f.wins ?? 0}-${f.losses ?? 0}-${f.draws ?? 0}, ${f.kos ?? 0} KO` : undefined,
        goal: goals.length ? goals.join(', ') : undefined,
        weeklyMinutes: weeklyMinutes || undefined,
        goals: dated.length ? dated : undefined,
        recovery,
      });
    };
    load();
  }, [profile.id, profile.full_name, section]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // ── La conversación sobrevive a salir de la pantalla ──
  //
  // Antes vivía solo en memoria: salías a mirar la Agenda, volvías, y no había
  // nada. Se guarda MIENTRAS no se esté escribiendo en streaming, para no
  // reescribir el almacén en cada token que llega.
  useEffect(() => {
    if (streaming || messages.length === 0) return;
    saveChat(profile.id, section, messages.map((m) => ({ role: m.role, content: m.content })));
  }, [messages, streaming, profile.id, section]);

  // ── Envío con STREAMING: la respuesta aparece token a token ──
  const send = useCallback(async (text: string) => {
    const content = text.trim();
    // Con foto se puede mandar sin escribir nada: enseñar algo y esperar a ver
    // qué dice es una forma normal de preguntar.
    if ((!content && !foto) || sending) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content, ...(foto ? { image: foto } : {}) }];
    setMessages(next);
    setInput('');
    setFoto(null);
    setSending(true);
    setSavedNote(null);
    setDismissedPlan(false);
    // Un cambio propuesto pertenece a la respuesta anterior: al preguntar otra
    // cosa deja de tener sentido ofrecerlo.
    setCambioDescartado(false);
    setSearching(false);

    try {
      // El token identifica al usuario en el servidor: sin él no hay forma de
      // contabilizar su consumo, y la IA no responde.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        // La foto viaja aparte del texto, en `image`: el servidor la convierte
        // en un bloque de imagen. Solo se manda la base64, no la previewUrl,
        // que es un blob: local y fuera de este navegador no existe.
        body: JSON.stringify({
          section,
          profile: physical,
          agenda: agenda.length ? agenda : undefined,
          historial: historial.length ? historial : undefined,
          // Igual que en el chat del plan: las fotos viejas se caen si no
          // caben todas. La conversación crece sola y la petición tiene un
          // techo duro (ver MAX_ADJUNTOS_B64); sin esto, la tercera foto
          // rompía un mensaje en el que no habías adjuntado nada.
          messages: limitarAdjuntos(next.map((m) => (m.image
            ? { role: m.role, content: m.content, image: { base64: m.image.base64, mediaType: m.image.mediaType } }
            : { role: m.role, content: m.content }))),
        }),
      });

      // Cuota agotada: se corta con buen tono, no con un error técnico.
      if (res.status === 429) {
        const d = await res.json().catch(() => ({}));
        if (d.error === 'quota_reached') {
          setQuotaBlocked({ title: t('mc_ai_quota_out_title'), desc: t('mc_ai_quota_out_desc') });
          setMessages(messages);
          setSending(false);
          return;
        }
      }
      if (res.status === 503) {
        const d = await res.json().catch(() => ({}));
        if (d.error === 'limits_not_configured') {
          setQuotaBlocked({ title: t('mc_ai_limits_off_title'), desc: t('mc_ai_limits_off_desc') });
          setMessages(messages);
          setSending(false);
          return;
        }
        setNotConfigured(true); setSending(false); return;
      }
      if (!res.ok || !res.body) {
        // Un 413 no lo manda la app: lo manda Vercel, en texto plano y antes
        // de que la función exista. Sin este caso el usuario leía un "no se
        // pudo generar respuesta" que no le decía qué arreglar.
        const d = await res.json().catch(() => ({}));
        const generico = res.status === 413 ? t('mc_chat_too_big_send') : t('mc_ai_err_generate');
        setMessages((prev) => [...prev, { role: 'assistant', content: d.message || generico }]);
        setSending(false);
        return;
      }

      // Hueco donde iremos escribiendo la respuesta según llega
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      setStreaming(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      let sawText = false; // para apagar el aviso de "buscando" en el primer token

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith('data:')) continue;
          try {
            const obj = JSON.parse(line.slice(5).trim());
            if (obj.delta) {
              if (!sawText) { sawText = true; setSearching(false); } // ya llega texto
              acc += obj.delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: acc };
                return copy;
              });
            } else if (obj.searching) {
              // El asesor de Material ha lanzado una búsqueda web.
              setSearching(true);
            } else if (obj.quota) {
              // Llega con el evento final: sirve para avisar al usuario
              // cuando se está acercando a su tope del mes.
              setQuota(obj.quota);
            } else if (obj.error) {
              acc += `\n\n${obj.error}`;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: acc };
                return copy;
              });
            }
          } catch { /* fragmento incompleto, seguimos */ }
        }
      }

      if (!acc.trim()) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: t('mc_ai_err_empty') };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('mc_ai_err_connection') }]);
    }
    setSearching(false);
    setStreaming(false);
    setSending(false);
  }, [messages, physical, section, sending, t, foto, agenda, historial]);

  // ── Guardar el plan acordado en el diario correspondiente ──
  const savePlan = useCallback(async () => {
    if (savingPlan) return;
    setSavingPlan(true);
    setSavedNote(null);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, profile: physical, messages, extract: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast?.(data.message || t('mc_ai_plan_none'), 'error');
        setSavingPlan(false);
        return;
      }

      if (section === 'training') {
        // El plan de la IA se reparte día a día en el PLAN de la agenda
        // (planned_events, hacia adelante), no en el registro de lo ya hecho.
        // Se marca source='ai' para pintarlo distinto; el peleador puede
        // editarlo o borrarlo como cualquier otra entrada.
        const rows = (data.plan?.sessions || []).map((s: Record<string, number | string>) => {
          const type = String(s.session_type || 'tecnica');
          const stKey = `mc_st_${type}`;
          const label = t(stKey);
          return {
            fighter_profile_id: profile.id,
            event_date: isoFromOffset(Number(s.day_offset)),
            kind: 'training',
            session_type: type,
            title: label && label !== stKey ? label : type,
            time: null,
            notes: String(s.notes || '').slice(0, 500) || null,
            done: false,
            source: 'ai',
          };
        });
        if (rows.length === 0) { showToast?.(t('mc_ai_plan_none'), 'error'); setSavingPlan(false); return; }
        // Reintenta sin `source` si la migración 0021 aún no está aplicada.
        let insErr = (await supabase.from('planned_events').insert(rows)).error;
        if (insErr && isMissingColumn(insErr)) {
          const bare = rows.map((r: Record<string, unknown>) => { const copy = { ...r }; delete copy.source; return copy; });
          insErr = (await supabase.from('planned_events').insert(bare)).error;
        }
        if (insErr) { showToast?.(t('mc_ai_plan_save_fail'), 'error'); setSavingPlan(false); return; }
        setSavedNote(t('mc_ai_plan_added_agenda', { count: rows.length }));
        showToast?.(t('mc_ai_plan_added_agenda', { count: rows.length }));
      } else {
        const rows = (data.plan?.meals || []).map((m: Record<string, number | string>) => ({
          fighter_profile_id: profile.id,
          entry_date: isoFromOffset(Number(m.day_offset)),
          meal_type: String(m.meal_type),
          description: String(m.description || '').slice(0, 500),
        })).filter((r: { description: string }) => r.description);
        if (rows.length === 0) { showToast?.(t('mc_ai_plan_none'), 'error'); setSavingPlan(false); return; }
        const { error } = await supabase.from('meal_entries').insert(rows);
        if (error) { showToast?.(t('mc_ai_meals_save_fail'), 'error'); setSavingPlan(false); return; }
        setSavedNote(t('mc_ai_meals_added', { count: rows.length }));
        showToast?.(t('mc_ai_meals_added', { count: rows.length }));
      }
    } catch {
      showToast?.(t('mc_ai_plan_save_generic'), 'error');
    }
    setSavingPlan(false);
  }, [savingPlan, section, physical, messages, profile.id, showToast, t]);

  // Solo en Consulta: las otras secciones no editan el plan semanal.
  const ultimo = messages.length > 0 ? messages[messages.length - 1] : null;
  const cambio = (section === 'general' && !cambioDescartado && !streaming && !sending
    && ultimo?.role === 'assistant')
    ? cambioPropuesto(ultimo.content)
    : null;

  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant';
  const showSaveBar = canSavePlan && lastIsAssistant && !streaming && !sending && !dismissedPlan && messages[messages.length - 1].content.length > 80;

  /**
   * Lleva el cambio propuesto al plan de verdad.
   *
   * No lo aplica este chat a mano: se lo pide al MISMO motor que monta el plan,
   * pasándole el plan actual y la instrucción en una frase. Así el cambio entra
   * con sus reglas —solo se toca lo que se pide, lo ya entrenado se respeta— en
   * vez de con una segunda lógica que acabaría discrepando de la primera.
   */
  const aplicarCambio = useCallback(async () => {
    if (!cambio || aplicando) return;
    setAplicando(true);
    const activo = await loadActivePlan(profile.id);
    if (!activo) {
      setAplicando(false);
      showToast?.(t('mc_ai_change_no_plan'), 'error');
      return;
    }
    const semanas = Math.max(1, activo.plan.weeks || 1);

    // La agenda que se mira aqui NO es la del estado.
    //
    // La del estado es una semana contada desde el lunes de HOY, que es lo que
    // Consulta necesita para responder "que ceno". El plan que se va a cambiar
    // puede empezar otro lunes y durar tres semanas: con la del estado, el
    // motor veria vacios los dias del plan que caen fuera de esa semana, y un
    // dia que parece vacio es un dia en el que se puede poner lo que sea.
    //
    // Se pide con el id del plan y se poda: lo que salio del plan ya viaja
    // dentro del propio plan, y mandarlo dos veces se paga dos veces.
    const agendaPlan = await loadAgendaSnapshot(profile.id, activo.plan.weekStart, semanas, activo.plan.id)
      .then(compactarAgenda)
      .catch(() => [] as AgendaDia[]);

    const ctx = {
      weekStart: activo.plan.weekStart,
      today: todayISO(),
      weeks: semanas,
      // Sin esta lista el motor se inventa los nombres.
      //
      // Iba vacia, y justo aqui es donde mas duele: el cambio tipico es
      // "cambiame el press por otro ejercicio". Si el sustituto sale con un
      // nombre que no esta en la biblioteca, al ir a registrarlo no enlaza con
      // nada: ni tecnica, ni historico, ni el peso que movias la otra vez.
      exerciseNames: libraryLabels(i18n.language === 'en' ? 'en' : 'es'),
      activityKinds: ACTIVITY_KINDS.map((k) => k.value),
    };
    const res = await sendPlanChat(
      [{ role: 'user', content: cambio }],
      ctx, physical, activo.plan, activo.plan.id, agendaPlan, historial, true,
    );
    if (!res.plan) {
      setAplicando(false);
      showToast?.(res.error || t('mc_ai_change_failed'), 'error');
      return;
    }
    const commit = await commitWeekPlan(profile.id, res.plan, { profile: physical });
    setAplicando(false);
    setCambioDescartado(true);
    if (commit.agendaUnavailable) { showToast?.(t('mc_ai_change_failed'), 'error'); return; }
    showToast?.(t('mc_ai_change_done', { n: commit.agendaItems }));
  }, [cambio, aplicando, profile.id, physical, historial, showToast, t, i18n.language]);

  if (checking) {
    return (
      <div className="rk-card flex items-center justify-center" style={{ height: 'min(560px, 72vh)' }}>
        <div className={`w-7 h-7 border-2 border-t-transparent rounded-full animate-spin ${a.spin}`}></div>
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="rk-card relative overflow-hidden text-center" style={{ padding: '44px 26px' }}>
        <div className="rk-glow-red" style={{ width: 220, height: 220, top: -90, right: -70, borderRadius: '50%' }} />
        <div className="relative">
          <div className={`w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl ${a.bg} border ${a.border} anim-float`}>
            <i className={`ri-sparkling-2-line text-3xl ${a.text}`}></i>
          </div>
          <span className={`inline-block text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full ${a.bg} ${a.text} mb-3`}>{t('mc_ai_soon')}</span>
          <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{title.toUpperCase()}</h3>
          <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed max-w-sm mx-auto">{intro}</p>
          <p className="text-xs text-zinc-500 mt-4 max-w-sm mx-auto leading-relaxed">
            {t('mc_ai_soon_desc', { extra: canSavePlan ? t('mc_ai_soon_desc_save') : '' })}
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-5 opacity-60">
            {suggestions.slice(0, 3).map((s) => (
              <span key={s} className="text-xs text-zinc-500 bg-white/[0.03] border border-white/10 rounded-full px-3 py-1.5">{s}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rk-card overflow-hidden flex flex-col" style={{ height: 'min(560px, 72vh)' }}>
      {/* Cabecera */}
      <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center gap-3 flex-shrink-0">
        <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${a.bg} border ${a.border} ${a.text}`}>
          <i className="ri-sparkling-2-line text-lg"></i>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white truncate">{title}</h3>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${a.bg} ${a.text}`}>AUTO</span>
          </div>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full rk-alive" style={{ background: a.dot, color: a.dot }} /> {t('mc_ai_context')}
          </p>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex justify-end px-4 pt-2">
          <button onClick={() => { setMessages([]); clearChat(profile.id, section); }}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer inline-flex items-center gap-1">
            <i className="ri-refresh-line" />{t('mc_ai_new_chat')}
          </button>
        </div>
      )}

      {/* Conversación */}
      <div className="rk-chat-wrap flex-1 min-h-0">
      <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-2 anim-scale-in">
            <div className={`w-14 h-14 flex items-center justify-center rounded-2xl ${a.bg} border ${a.border} ${a.text} mb-3 anim-float`}>
              <i className="ri-chat-smile-3-line text-2xl"></i>
            </div>
            <p className="text-sm text-zinc-300 font-medium max-w-xs">{intro}</p>
            {/* Tarjetas, no pastillas. Son preguntas enteras: en pastilla se
                parten en dos líneas y quedan rotas, y además el chat del plan
                ya las enseña así — dos chats hermanos con la misma pantalla
                vacía hecha de dos formas distintas se notan. */}
            <div className="grid gap-1.5 mt-4 w-full max-w-sm mx-auto">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={sending}
                  className="rk-chip flex items-center gap-2.5 text-left text-xs text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 hover:text-white hover:bg-white/[0.07] rounded-xl px-3 py-2.5 cursor-pointer disabled:opacity-50">
                  <i className="ri-chat-1-line text-base flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <span className="min-w-0">{s}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const mio = m.role === 'user';
            // El avatar solo en el PRIMER mensaje de una tanda suya. Repetirlo en
            // cada burbuja de una respuesta larga partida en trozos llena la
            // columna de iconos y hace que parezca que habla mucha gente.
            const abre = !mio && (i === 0 || messages[i - 1].role === 'user');
            return (
              <div key={i} className={`flex items-end gap-2 ${mio ? 'justify-end' : 'justify-start'} ${mio ? 'rk-msg-mine' : 'rk-msg-yours'}`}>
                {!mio && (
                  <div className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center ${abre ? 'rk-ai-avatar' : 'opacity-0'}`}>
                    <i className="ri-sparkling-2-line text-sm" />
                  </div>
                )}
                <div className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${mio
                  ? 'rk-bubble-mine rounded-2xl rounded-br-md'
                  : `rk-bubble-theirs text-zinc-200 rounded-2xl ${abre ? 'rounded-bl-md' : ''}`}`}>
                  {m.image && (
                    m.image.esPdf
                      ? <span className="flex items-center gap-2 mb-1.5 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.22)' }}>
                          <i className="ri-file-pdf-line text-lg" />
                          <span className="text-xs font-semibold truncate">{m.image.nombre || 'PDF'}</span>
                        </span>
                      : <img src={m.image.previewUrl} alt=""
                          className="rounded-xl mb-1.5 max-h-52 w-auto" style={{ maxWidth: '100%' }} />
                  )}
                  {m.role === 'assistant'
                    ? (searching && m.content === '' && i === messages.length - 1
                        ? <span className="flex items-center gap-2 text-zinc-400"><i className="ri-earth-line text-sky-400 animate-pulse"></i>{t('mc_ai_searching')}</span>
                        : <div className="space-y-0.5">{renderRich(sinMarcadorCambio(m.content), t('mc_ai_video_watch'))}{streaming && i === messages.length - 1 && <span className="rk-caret" />}</div>)
                    : m.content}
                </div>
              </div>
            );
          })
        )}
        {sending && !streaming && (
          <div className="flex items-end gap-2 justify-start rk-msg-yours mt-3">
            <div className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center rk-ai-avatar">
              <i className="ri-sparkling-2-line text-sm" />
            </div>
            <div className="rk-bubble-theirs rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map((n) => <span key={n} className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${n * 0.15}s` }} />)}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Cuota agotada o control de gasto sin configurar */}
      {quotaBlocked && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="flex items-start gap-2.5 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/35 px-3.5 py-3">
            <i className="ri-time-line text-[#C9A84C] mt-0.5 flex-shrink-0"></i>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#C9A84C]">{quotaBlocked.title}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{quotaBlocked.desc}</p>
            </div>
          </div>
        </div>
      )}

      {/* Aviso al acercarse al tope del mes */}
      {!quotaBlocked && quota && quota.quota > 0 &&
        (quota.used / quota.quota) * 100 >= quota.warnAtPct && quota.used < quota.quota && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/12 px-3.5 py-2">
            <i className="ri-battery-low-line text-orange-400 flex-shrink-0"></i>
            <p className="text-[11px] text-zinc-300">{t('mc_ai_quota_warn', { n: Math.max(0, quota.quota - quota.used) })}</p>
          </div>
        </div>
      )}

      {/* ── Aplicar un cambio al plan, desde aquí ──
          El asesor ya ve la agenda, así que puede razonar sobre el plan. Lo
          que faltaba era poder APLICARLO: sin esto, te decía "muévelo al
          viernes" y tenías que irte al chat de plan a repetírselo.
          Se apoya en el mismo motor del plan, así que el cambio entra con las
          mismas reglas: lo ya entrenado no se toca. */}
      {cambio && !quotaBlocked && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="rounded-xl bg-white/[0.04] border border-white/12 px-3.5 py-2.5">
            <p className="text-xs text-zinc-300 mb-2 flex items-start gap-1.5">
              <i className="ri-calendar-check-line text-zinc-500 mt-0.5 flex-shrink-0" />
              <span className="min-w-0">{cambio}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={aplicarCambio} disabled={aplicando}
                className="rk-btn rk-btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                style={{ minHeight: 42 }}>
                {aplicando
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('mc_ai_change_applying')}</>
                  : <><i className="ri-check-line" /> {t('mc_ai_change_apply')}</>}
              </button>
              <button onClick={() => setCambioDescartado(true)} disabled={aplicando}
                className="px-3.5 rounded-lg border border-white/12 text-sm text-zinc-400 hover:text-white hover:border-white/30 cursor-pointer disabled:opacity-60">
                {t('mc_ai_plan_no')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ¿Añadir el plan propuesto? Es opcional: la IA lo propone y el peleador
          decide. Nunca se añade sin que pulse "Sí". */}
      {showSaveBar && !quotaBlocked && (
        <div className="px-3 pb-2 flex-shrink-0">
          {savedNote ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 px-3.5 py-2.5">
              <i className="ri-check-double-line text-green-400"></i>
              <span className="text-xs text-green-300 flex-1">{savedNote}</span>
            </div>
          ) : (
            <div className="rounded-xl bg-white/[0.04] border border-white/12 px-3.5 py-2.5">
              <p className="text-xs text-zinc-300 mb-2 flex items-center gap-1.5">
                <i className={`ri-sparkling-line ${a.text}`}></i>
                {section === 'training' ? t('mc_ai_plan_q_agenda') : t('mc_ai_plan_q_diary')}
              </p>
              <div className="flex gap-2">
                <button onClick={savePlan} disabled={savingPlan}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white py-2 transition-colors cursor-pointer disabled:opacity-60">
                  {savingPlan
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_ai_plan_adding')}</>
                    : <><i className={section === 'training' ? 'ri-calendar-todo-line' : 'ri-restaurant-line'}></i> {t('mc_ai_plan_yes')}</>}
                </button>
                <button onClick={() => setDismissedPlan(true)} disabled={savingPlan}
                  className="px-3.5 rounded-lg border border-white/12 text-sm text-zinc-400 hover:text-white hover:border-white/30 transition-colors cursor-pointer disabled:opacity-60">
                  {t('mc_ai_plan_no')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entrada */}
      <div className="p-3 border-t border-white/[0.07] flex-shrink-0">
        {foto && <FotoPendiente foto={foto} onQuitar={() => setFoto(null)} />}
        {/* Mismo criterio que en el chat de plan: el campo ocupa la fila entera
            y las acciones van debajo. Aquí, además, faltaba poder dictar —
            preguntar en voz alta es justo lo que se hace en un gimnasio— y el
            campo estaba a 14px, que es lo que hace que el iPhone amplíe la app
            al tocarlo. */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          disabled={sending}
          rows={2}
          maxLength={2000}
          className={`w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none resize-none ${a.ring} disabled:opacity-60`}
          style={{ fontSize: 16 }}
          placeholder={t('mc_ai_input_ph')}
        />
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-2 min-w-0">
            <PhotoAttach foto={foto} onFoto={setFoto} disabled={sending}
              onError={(m) => showToast?.(m, 'error')} />
            <VoiceButton onResult={(s) => setInput((p) => (p ? `${p} ${s}` : s))} />
          </div>
          <button onClick={() => send(input)} disabled={sending || (!input.trim() && !foto)}
            className="rk-btn rk-btn-primary flex items-center gap-2 justify-center flex-shrink-0 disabled:opacity-50"
            style={{ minHeight: 46, padding: '0 1.1rem' }}>
            <i className="ri-send-plane-2-fill"></i>{t('mc_ai_send_btn')}
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2 text-center">{t('mc_ai_disclaimer')}</p>
      </div>
    </div>
  );
}

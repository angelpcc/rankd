import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase, Profile } from '@/lib/supabase';

type Section = 'training' | 'nutrition' | 'gear';
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

interface ChatMsg { role: 'user' | 'assistant'; content: string }

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

// Marcador de vídeo que emite el Coach de Entrenamiento: [VIDEO: nombre].
// Lo convertimos en un botón que abre una búsqueda de YouTube para esa técnica.
// Usamos búsqueda (no una URL concreta) para que el enlace SIEMPRE sea válido:
// la IA no puede inventar un vídeo que no exista.
const VIDEO_RE = /\[VIDEO:\s*([^\]]+)\]/gi;

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

// Renderiza una línea: negritas + los marcadores [VIDEO: ...] como botones.
function renderInline(text: string, keyBase: string) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  VIDEO_RE.lastIndex = 0;
  while ((m = VIDEO_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderBold(text.slice(last, m.index), `${keyBase}-t${idx}`));
    const q = m[1].trim();
    nodes.push(
      <a key={`${keyBase}-v${idx}`} href={youtubeSearch(q)} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 align-middle mx-0.5 my-0.5 rounded-lg bg-red-600/12 border border-red-500/35 text-red-300 hover:bg-red-600/20 hover:text-red-200 transition-colors px-2 py-0.5 text-xs font-semibold no-underline">
        <i className="ri-play-circle-fill"></i>Ver: {q}
      </a>
    );
    last = m.index + m[0].length;
    idx++;
  }
  if (last < text.length) nodes.push(...renderBold(text.slice(last), `${keyBase}-t${idx}`));
  return nodes;
}

// Formateo ligero del markdown que devuelve la IA (negritas, listas, saltos, vídeos).
function renderRich(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    const bullet = /^[-*•]\s+/.test(trimmed);
    const clean = bullet ? trimmed.replace(/^[-*•]\s+/, '') : line;
    const parts = renderInline(clean, `l${i}`);
    if (bullet) {
      return <div key={i} className="flex gap-2 pl-1"><span className="text-zinc-600 mt-1.5 flex-shrink-0" style={{ fontSize: 6 }}>●</span><span>{parts}</span></div>;
    }
    if (trimmed === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{parts}</div>;
  });
}

export default function SectionCoach({ section, profile, title, intro, suggestions, accent = 'red', showToast }: Props) {
  const a = ACCENTS[accent];
  const canSavePlan = section === 'training' || section === 'nutrition';
  const [physical, setPhysical] = useState<Record<string, unknown>>({});
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [checking, setChecking] = useState(true);
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
      // Los objetivos solo importan al Coach de Entrenamiento. Su tabla puede no
      // existir aún (migración pendiente): si falla, se ignora.
      const goalsQ = section === 'training'
        ? supabase.from('fighter_goals').select('title, category, target_value, unit, deadline').eq('fighter_profile_id', profile.id).eq('status', 'active')
        : Promise.resolve({ data: null });

      const [{ data: f }, { data: w }, { data: g }, { data: sess }, goalRes] = await Promise.all([
        supabase.from('fighters').select('discipline, weight_class, experience_level, age, wins, losses, draws, kos, looking_for').eq('profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('weight_kg').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
        supabase.from('training_sessions').select('duration_min, session_date').eq('fighter_profile_id', profile.id).order('session_date', { ascending: false }).limit(30),
        goalsQ,
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
      });
    };
    load();
  }, [profile.id, profile.full_name, section]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // ── Envío con STREAMING: la respuesta aparece token a token ──
  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setSending(true);
    setSavedNote(null);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, profile: physical, messages: next }),
      });

      if (res.status === 503) { setNotConfigured(true); setSending(false); return; }
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, { role: 'assistant', content: d.message || 'No se pudo generar respuesta. Inténtalo de nuevo.' }]);
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
              acc += obj.delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: acc };
                return copy;
              });
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
          copy[copy.length - 1] = { role: 'assistant', content: 'No he podido generar respuesta, inténtalo de nuevo.' };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Se ha cortado la conexión con la IA. Inténtalo de nuevo.' }]);
    }
    setStreaming(false);
    setSending(false);
  }, [messages, physical, section, sending]);

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
        showToast?.(data.message || 'No he encontrado un plan concreto que guardar', 'error');
        setSavingPlan(false);
        return;
      }

      if (section === 'training') {
        const rows = (data.plan?.sessions || []).map((s: Record<string, number | string>) => ({
          fighter_profile_id: profile.id,
          session_date: isoFromOffset(Number(s.day_offset)),
          session_type: String(s.session_type),
          duration_min: Number(s.duration_min) || null,
          intensity: Number(s.intensity) || 3,
          notes: String(s.notes || '').slice(0, 500) || null,
        }));
        if (rows.length === 0) { showToast?.('No he encontrado un plan concreto en la conversación', 'error'); setSavingPlan(false); return; }
        const { error } = await supabase.from('training_sessions').insert(rows);
        if (error) { showToast?.('No se pudo guardar en el diario', 'error'); setSavingPlan(false); return; }
        setSavedNote(`${rows.length} ${rows.length === 1 ? 'sesión guardada' : 'sesiones guardadas'} en tu diario de entrenos`);
        showToast?.(`Plan guardado: ${rows.length} ${rows.length === 1 ? 'sesión' : 'sesiones'} 💪`);
      } else {
        const rows = (data.plan?.meals || []).map((m: Record<string, number | string>) => ({
          fighter_profile_id: profile.id,
          entry_date: isoFromOffset(Number(m.day_offset)),
          meal_type: String(m.meal_type),
          description: String(m.description || '').slice(0, 500),
        })).filter((r: { description: string }) => r.description);
        if (rows.length === 0) { showToast?.('No he encontrado un plan concreto en la conversación', 'error'); setSavingPlan(false); return; }
        const { error } = await supabase.from('meal_entries').insert(rows);
        if (error) { showToast?.('No se pudo guardar en el diario de comidas', 'error'); setSavingPlan(false); return; }
        setSavedNote(`${rows.length} ${rows.length === 1 ? 'comida guardada' : 'comidas guardadas'} en tu diario`);
        showToast?.(`Plan guardado: ${rows.length} ${rows.length === 1 ? 'comida' : 'comidas'} 🍽️`);
      }
    } catch {
      showToast?.('No se pudo guardar el plan', 'error');
    }
    setSavingPlan(false);
  }, [savingPlan, section, physical, messages, profile.id, showToast]);

  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant';
  const showSaveBar = canSavePlan && lastIsAssistant && !streaming && !sending && messages[messages.length - 1].content.length > 80;

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
          <span className={`inline-block text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full ${a.bg} ${a.text} mb-3`}>Muy pronto</span>
          <h3 className="rk-h3" style={{ fontSize: '1.3rem', color: '#fff' }}>{title.toUpperCase()}</h3>
          <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed max-w-sm mx-auto">{intro}</p>
          <p className="text-xs text-zinc-500 mt-4 max-w-sm mx-auto leading-relaxed">
            Estamos afinando este asistente. Cuando se active, usará tu perfil físico y tus datos de Mi Esquina para responderte{canSavePlan ? ', y podrás guardar el plan directamente en tu diario' : ''}. Mientras tanto, el resto de la sección funciona con normalidad.
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
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${a.bg} ${a.text}`}>IA</span>
          </div>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.dot }} /> Usa tu perfil físico como contexto
          </p>
        </div>
      </div>

      {/* Conversación */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-2">
            <div className={`w-12 h-12 flex items-center justify-center rounded-2xl ${a.bg} border ${a.border} ${a.text} mb-3`}>
              <i className="ri-chat-smile-3-line text-xl"></i>
            </div>
            <p className="text-sm text-zinc-300 font-medium max-w-xs">{intro}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={sending}
                  className="text-xs text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 hover:text-white rounded-full px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-red-600 text-white' : 'bg-white/[0.05] border border-white/10 text-zinc-200'}`}>
                {m.role === 'assistant'
                  ? <div className="space-y-0.5">{renderRich(m.content)}{streaming && i === messages.length - 1 && <span className="inline-block w-1.5 h-3.5 bg-zinc-400 ml-0.5 align-middle animate-pulse" />}</div>
                  : m.content}
              </div>
            </div>
          ))
        )}
        {sending && !streaming && (
          <div className="flex justify-start">
            <div className="bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map((n) => <span key={n} className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${n * 0.15}s` }} />)}
            </div>
          </div>
        )}
      </div>

      {/* Guardar plan en el diario */}
      {showSaveBar && (
        <div className="px-3 pb-2 flex-shrink-0">
          {savedNote ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 px-3.5 py-2.5">
              <i className="ri-check-double-line text-green-400"></i>
              <span className="text-xs text-green-300 flex-1">{savedNote}</span>
            </div>
          ) : (
            <button onClick={savePlan} disabled={savingPlan}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-white/12 hover:border-white/30 text-sm text-white py-2.5 transition-colors cursor-pointer disabled:opacity-60">
              {savingPlan
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Guardando plan...</>
                : <><i className="ri-save-line"></i> Guardar este plan en mi {section === 'training' ? 'diario de entrenos' : 'diario de comidas'}</>}
            </button>
          )}
        </div>
      )}

      {/* Entrada */}
      <div className="p-3 border-t border-white/[0.07] flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            disabled={sending}
            className={`flex-1 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none ${a.ring} disabled:opacity-60`}
            placeholder="Escribe tu pregunta..."
          />
          <button onClick={() => send(input)} disabled={sending || !input.trim()}
            className="rk-btn rk-btn-primary flex items-center justify-center disabled:opacity-50" style={{ padding: '0 1.1rem', fontSize: '1rem' }}>
            <i className="ri-send-plane-2-fill"></i>
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2 text-center">La IA puede equivocarse. No sustituye a tu entrenador, médico ni dietista.</p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
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
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};
const levelLabels: Record<string, string> = {
  amateur: 'Amateur', semi_pro: 'Semi-profesional', professional: 'Profesional',
};

const ACCENTS: Record<Accent, { text: string; bg: string; border: string; ring: string; dot: string }> = {
  red: { text: 'text-red-400', bg: 'bg-red-600/12', border: 'border-red-500/30', ring: 'focus:border-red-500', dot: '#E10600' },
  gold: { text: 'text-[#C9A84C]', bg: 'bg-[#C9A84C]/12', border: 'border-[#C9A84C]/35', ring: 'focus:border-[#C9A84C]', dot: '#C9A84C' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/12', border: 'border-sky-500/30', ring: 'focus:border-sky-500', dot: '#38bdf8' },
};

// Formateo ligero del markdown que devuelve la IA (negritas, listas, saltos).
function renderRich(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    const bullet = /^[-*•]\s+/.test(trimmed);
    const clean = bullet ? trimmed.replace(/^[-*•]\s+/, '') : line;
    const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith('**') && seg.endsWith('**')
        ? <strong key={j} className="text-white font-semibold">{seg.slice(2, -2)}</strong>
        : <span key={j}>{seg}</span>
    );
    if (bullet) {
      return <div key={i} className="flex gap-2 pl-1"><span className="text-zinc-600 mt-1.5 flex-shrink-0" style={{ fontSize: 6 }}>●</span><span>{parts}</span></div>;
    }
    if (trimmed === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{parts}</div>;
  });
}

export default function SectionCoach({ section, profile, title, intro, suggestions, accent = 'red' }: Props) {
  const a = ACCENTS[accent];
  const [physical, setPhysical] = useState<Record<string, unknown>>({});
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [checking, setChecking] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Comprobamos disponibilidad al abrir para mostrar "próximamente" de entrada
  // en vez de esperar a que el usuario escriba y se tope con un fallo.
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

  // Reunimos el perfil físico del peleador (contexto de la IA).
  useEffect(() => {
    const load = async () => {
      const [{ data: f }, { data: w }, { data: g }] = await Promise.all([
        supabase.from('fighters').select('discipline, weight_class, experience_level, age, nickname, wins, losses, draws, kos').eq('profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('weight_kg').eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle(),
      ]);
      setPhysical({
        name: (profile.full_name || '').split(' ')[0] || undefined,
        discipline: f?.discipline ? (disciplineLabels[f.discipline] || f.discipline) : undefined,
        level: f?.experience_level ? (levelLabels[f.experience_level] || f.experience_level) : undefined,
        weightClass: f?.weight_class || undefined,
        age: f?.age || undefined,
        currentWeight: (w as { weight_kg?: number } | null)?.weight_kg || undefined,
        targetWeight: (g as { target_weight_kg?: number } | null)?.target_weight_kg || undefined,
        record: f ? `${f.wins ?? 0}-${f.losses ?? 0}-${f.draws ?? 0}, ${f.kos ?? 0} KO` : undefined,
      });
    };
    load();
  }, [profile.id, profile.full_name]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, profile: physical, messages: next }),
      });
      if (res.status === 503) { setNotConfigured(true); setSending(false); return; }
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message || 'No se pudo generar respuesta. Inténtalo de nuevo.' }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'No hay conexión con la IA ahora mismo. Inténtalo de nuevo.' }]);
    }
    setSending(false);
  }, [messages, physical, section, sending]);

  // Mientras comprobamos, un esqueleto sobrio (evita parpadeo de UI)
  if (checking) {
    return (
      <div className="rk-card flex items-center justify-center" style={{ height: 'min(560px, 72vh)' }}>
        <div className={`w-7 h-7 border-2 border-t-transparent rounded-full animate-spin ${accent === 'gold' ? 'border-[#C9A84C]' : accent === 'sky' ? 'border-sky-500' : 'border-red-500'}`}></div>
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
            Estamos afinando este asistente. Cuando se active, usará tu perfil físico y tus datos de Mi Esquina para responderte. Mientras tanto, el resto de la sección funciona con normalidad.
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
                {m.role === 'assistant' ? <div className="space-y-0.5">{renderRich(m.content)}</div> : m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map((n) => <span key={n} className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${n * 0.15}s` }} />)}
            </div>
          </div>
        )}
      </div>

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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';
import VoiceButton from '@/components/feature/VoiceButton';
import { activityKindCfg, fmtSetCount } from '../lib/dayPlan';
import {
  commitWeekPlan, currentWeekStart, dateOfWeekday, loadActivePlan, planTotals, weeksOf,
  type CommitResult, type WeekPlan,
} from '../lib/weekPlan';
import { buildWeekContext, checkWeekPlanAvailable } from '@/services/weekPlanAdvisor';
import { sendPlanChat, type PlanChatMessage } from '@/services/planChat';
import { clearChat, loadChat, saveChat } from '../lib/chatHistory';

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
  const finRef = useRef<HTMLDivElement>(null);

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
      const [activo, f, w, g] = await Promise.all([
        // El plan que ya esté vivo se carga de entrada: pedir un cambio sobre él
        // debe modificarlo, no crear otro encima (punto 27).
        loadActivePlan(profile.id),
        supabase.from('fighters').select('discipline, weight_class, experience_level, age')
          .eq('profile_id', profile.id).maybeSingle(),
        supabase.from('weight_entries').select('weight_kg')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutrition_goals').select('target_weight_kg')
          .eq('fighter_profile_id', profile.id).maybeSingle(),
      ]);
      if (!alive) return;
      // Primero la conversación que quedó a medias: es lo que el usuario dejó
      // abierto. Salir a mirar la Agenda y volver no puede borrar cinco turnos
      // de trabajo, y menos cuando cada turno cuesta dinero.
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
      } else if (activo) {
        setPlan(activo.plan);
        setWeeks(Math.max(1, activo.plan.weeks || 1));
        setTurnos([{ role: 'assistant', content: t('mc_pc_resumed'), plan: activo.plan }]);
      }
      const fr = f.data as { discipline?: string; weight_class?: string; experience_level?: string; age?: number } | null;
      setFighter({
        name: (profile.full_name || '').split(' ')[0] || undefined,
        discipline: fr?.discipline, level: fr?.experience_level,
        weightClass: fr?.weight_class, age: fr?.age,
        currentWeight: (w.data as { weight_kg?: number } | null)?.weight_kg,
        targetWeight: (g.data as { target_weight_kg?: number } | null)?.target_weight_kg,
      });
    })();
    return () => { alive = false; };
  }, [profile.id, profile.full_name, t]);

  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }); }, [turnos, enviando]);

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
    if (!msg || enviando) return;

    const historia: PlanChatMessage[] = [
      ...turnos.map((x) => ({ role: x.role, content: x.content })),
      { role: 'user' as const, content: msg },
    ];
    setTurnos((p) => [...p, { role: 'user', content: msg }]);
    setTexto('');
    setEnviando(true);

    // El id se conserva si ya había plan: es lo que impide que un cambio cree
    // un plan paralelo y duplique las entradas de la Agenda.
    const res = await sendPlanChat(historia, ctx, fighter, plan, plan?.id || `wp_${Date.now().toString(36)}`);
    setEnviando(false);

    if (res.error) {
      showToast(res.error === 'auth' ? t('mc_pc_err_auth') : res.error, 'error');
      return;
    }
    setTurnos((p) => [...p, { role: 'assistant', content: res.reply, ...(res.plan ? { plan: res.plan } : {}) }]);
    if (res.plan) { setPlan(res.plan); setGuardado(null); }
  }, [texto, enviando, turnos, ctx, fighter, plan, showToast, t]);

  const guardar = async () => {
    if (!plan || guardando) return;
    setGuardando(true);
    const res = await commitWeekPlan(profile.id, plan);
    setGuardando(false);
    setGuardado(res);
    if (res.agendaUnavailable) { showToast(t('mc_pc_agenda_off'), 'error'); return; }
    showToast(t('mc_pc_saved', { n: res.agendaItems }));
  };

  const sinIA = aiOk === false;

  return (
    <div className="rk-blocks max-w-3xl">
      {/* ── La conversación ── */}
      <div className="rk-card" style={{ padding: 16 }}>
        {turnos.length > 0 && (
          <div className="flex justify-end mb-2">
            <button onClick={() => {
              // Se borra también el plan en curso: dejarlo colgando de una
              // conversación que ya no existe confunde más que ayudar. Lo que
              // se guardó en la Agenda no se toca — eso ya está a salvo.
              setTurnos([]); setPlan(null); setGuardado(null);
              clearChat(profile.id, 'plan');
            }}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer inline-flex items-center gap-1">
              <i className="ri-refresh-line" />{t('mc_pc_new_chat')}
            </button>
          </div>
        )}
        <div className="space-y-3" style={{ maxHeight: '58vh', overflowY: 'auto' }}>
          {turnos.length === 0 && (
            <div className="py-4">
              <p className="text-sm text-zinc-300 leading-relaxed">{t('mc_pc_intro')}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {[t('mc_pc_sug_1'), t('mc_pc_sug_2'), t('mc_pc_sug_3')].map((s) => (
                  <button key={s} onClick={() => enviar(s)} disabled={enviando || sinIA}
                    className="text-xs text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 hover:text-white rounded-full px-3 py-1.5 cursor-pointer disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turnos.map((x, i) => (
            <div key={i}>
              <div className={`flex ${x.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${x.role === 'user' ? 'bg-red-600 text-white' : 'bg-white/[0.05] border border-white/10 text-zinc-200'}`}>
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
          ))}

          {enviando && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3.5 py-2.5 bg-white/[0.05] border border-white/10 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-zinc-400">{t('mc_pc_thinking')}</span>
              </div>
            </div>
          )}
          <div ref={finRef} />
        </div>

        {/* ── Escribir ── */}
        <div className="flex items-end gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--s-3)' }}>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={2000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder={t('mc_pc_ph')} disabled={sinIA}
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none disabled:opacity-50"
            style={{ fontSize: 16 }} />
          <VoiceButton onResult={(s) => setTexto((p) => (p ? `${p} ${s}` : s))} />
          <button onClick={() => enviar()} disabled={enviando || !texto.trim() || sinIA}
            className="rk-btn rk-btn-primary flex-shrink-0 disabled:opacity-50"
            style={{ minHeight: 46, padding: '0 1rem' }}>
            <i className="ri-send-plane-fill" />
          </button>
        </div>
        {sinIA && <p className="text-[11px] text-[#C9A84C] mt-2 leading-relaxed">{t('mc_pc_no_ai')}</p>}
      </div>

      {/* ── Mandarlo a la app ──
          Fijo abajo y no dentro de un mensaje: el plan cambia con cada turno y
          el botón tiene que referirse SIEMPRE al último, no a una versión que
          quedó a mitad de la conversación. */}
      {plan && !guardado && (
        <div className="rk-card" style={{ padding: 16, borderColor: 'rgba(225,6,0,0.35)' }}>
          <p className="text-sm font-bold text-white">{t('mc_pc_ready_title')}</p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t('mc_pc_ready_desc')}</p>
          <button onClick={guardar} disabled={guardando}
            className="rk-cta rk-press w-full flex items-center justify-center gap-2 mt-3 disabled:opacity-60"
            style={{ minHeight: 48 }}>
            {guardando
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><i className="ri-calendar-check-line text-lg" /> {t('mc_pc_send')}</>}
          </button>
        </div>
      )}

      {guardado && (
        <div className="rk-card" style={{ padding: 16, borderColor: 'rgba(74,222,128,0.35)' }}>
          <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#4ade80' }}>
            <i className="ri-check-double-line" />{t('mc_pc_done_title')}
          </p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            {t('mc_pc_done_desc', { n: guardado.agendaItems })}
            {guardado.keptCompleted.length > 0 && ` ${t('mc_pc_done_kept', { n: guardado.keptCompleted.length })}`}
          </p>
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

  return (
    <div className="rounded-2xl border mt-2 overflow-hidden"
      style={{ borderColor: vigente ? 'rgba(225,6,0,0.35)' : 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--s-3)' }}>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: vigente ? 'var(--accent)' : 'var(--t-3)' }}>
          {vigente ? t('mc_pc_plan_current') : t('mc_pc_plan_old')}
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          {total > 1 ? t('mc_pc_weeks_n', { n: total }) : t('mc_pc_weeks_1')}
          {' · '}{t('mc_pc_stat_strength', { n: stats.strengthDays })}
          {stats.cardioSlots > 0 && ` · ${t('mc_pc_stat_cardio', { n: stats.cardioSlots })}`}
          {stats.meals > 0 && ` · ${t('mc_pc_stat_meals', { n: stats.meals })}`}
        </p>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--s-3)' }}>
        {dias.map(({ d, fuerza, cardio, comidas }) => (
          <div key={d} className="px-3.5 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 capitalize">{etiquetaDia(plan, d, locale)}</p>
            {fuerza.map((s, i) => (
              <div key={`f${i}`} className="mt-1.5">
                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <i className="ri-hammer-line" style={{ color: '#fb923c' }} />
                  {s.name || s.groups.join(' + ')}
                </p>
                {s.exercises.length > 0 && (
                  <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">
                    {s.exercises.slice(0, 6).map((e) => `${e.name} ${fmtSetCount(e.sets, e, t)}`).join(' · ')}
                    {s.exercises.length > 6 && ` +${s.exercises.length - 6}`}
                  </p>
                )}
              </div>
            ))}
            {cardio.map((p, i) => {
              const cfg = activityKindCfg(p.kind);
              const min = Math.round(p.segments.reduce((a, s) => a + (s.seconds || 0), 0) / 60);
              return (
                <div key={`c${i}`} className="mt-1.5">
                  <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <i className={cfg.icon} style={{ color: cfg.hex }} />
                    {p.name || t(cfg.labelKey)}
                    {min > 0 && <span className="text-zinc-500 font-normal">· {min} min</span>}
                  </p>
                </div>
              );
            })}
            {comidas.map((n, i) => (
              <p key={`m${i}`} className="text-[11px] text-zinc-500 leading-snug mt-1.5">
                <i className="ri-restaurant-line mr-1" style={{ color: '#38bdf8' }} />
                {n.meals.map((m) => `${t(`mc_dp_slot_${m.slot}`, { defaultValue: m.slot })}: ${m.text}`).join(' · ')}
              </p>
            ))}
          </div>
        ))}
      </div>

      {plan.disclaimer && (
        <p className="px-3.5 py-2 text-[10px] text-zinc-600 leading-relaxed" style={{ borderTop: '1px solid var(--s-3)' }}>
          {plan.disclaimer}
        </p>
      )}
    </div>
  );
}


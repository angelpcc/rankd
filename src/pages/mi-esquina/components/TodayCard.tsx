import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import PhotoCard from '@/components/base/PhotoCard';
import { SkeletonBox } from '@/components/base/Skeleton';
import { type StrengthPayload, type ActivityPayload, activityKindCfg, exerciseLines, KIND_META } from '../lib/dayPlan';
import { loadTodayTraining, type PlannedEntry } from '../lib/todayTraining';

// "Tu siguiente acción" — el elemento PRINCIPAL del Resumen y el ÚNICO CTA rojo
// de la pantalla. Es una PhotoCard (fondo a sangre + degradado + texto) cuyo
// estado cambia por prioridad:
//
//   1. combate próximo  (solo PRO, pelea a ≤7 días)
//   2. entreno PLANIFICADO hoy y sin completar
//   3. peso sin registrar (≥4 días, o pesaje PRO cerca)
//   4. hoy ya se ha entrenado → confirmación, sin CTA rojo
//   5. día de descanso / sin nada planificado
//   6. sin plan
//
// El botón interno es el CTA principal (rk-cta rojo). No debe haber otro CTA
// rojo en el Resumen.
//
// ── UNA SOLA CONDICIÓN PARA EL ESTADO 2 ──
// "Entreno pendiente" sale si y solo si hay una entrada PLANIFICADA en la
// Agenda para hoy sin completar. La condición vive entera en
// `lib/todayTraining.ts` y la comparten esta tarjeta, la de Fuerza y la de
// Actividad. Aquí no se calcula nada: ni volumen, ni grupo recomendado, ni
// sugerencias.
//
// ── FUERZA Y ACTIVIDAD NO COMPARTEN TARJETA ──
//
// Antes el estado 2 pintaba UNA tarjeta con el primer pendiente y un "+N" para
// el resto. Con eso, al resolver la actividad el bloque de fuerza ascendía a
// ese hueco y parecía que "al terminar la actividad aparecía Pierna". No
// aparecía nada: es que solo cabía uno, y encima el orden lo decidía la base de
// datos.
//
// Ahora son dos tarjetas independientes, cada una con su tipo, su imagen y su
// destino (Fuerza / Actividad). Resolver una no toca a la otra. Si solo hay una
// planificada, solo se pinta una.

interface Props {
  profile: Profile;
  mode: 'pro' | 'hobby';
  onStart: () => void;       // abre la agenda del día
  onCreatePlan: () => void;  // abre Asesor (plan)
  onLogWeight: () => void;    // abre Peso
  /** Abre Actividad con hoy puesto y, si se le pasa, el tipo ya elegido. */
  onLogToday: (kind?: string) => void;
  /** Abre Fuerza en la pantalla de registro. */
  onGoStrength: () => void;
  /**
   * Sube al registrar o borrar una sesión. Fuerza a releer el día para que lo
   * que se acaba de hacer deje de salir como pendiente sin recargar la página.
   */
  refreshKey?: number;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Días de diferencia entre `iso` y hoy, ambos a medianoche. Positivo = futuro
// (faltan N días), negativo = pasado (hace N días).
function dayDelta(iso: string): number {
  const a = new Date(iso + 'T00:00:00'); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

interface TrainToday { icon: string; title: string; note: string | null; actKind?: string }
interface FightRow { event_date: string; title: string; kind: string }

export default function TodayCard({ profile, mode, onStart, onCreatePlan, onLogWeight, onLogToday, onGoStrength, refreshKey = 0 }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [loading, setLoading] = useState(true);
  // Dos listas, no una: ver la nota de cabecera. Resolver la actividad no puede
  // hacer que ascienda un bloque de fuerza al mismo hueco.
  const [pendStr, setPendStr] = useState<TrainToday[]>([]);
  const [pendAct, setPendAct] = useState<TrainToday[]>([]);
  // Lo que se ha entrenado hoy DE VERDAD (de las tablas de sesiones, no de la
  // Agenda). Nunca pinta "pendiente": solo el estado de confirmación.
  const [doneLabel, setDoneLabel] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [daysSinceWeight, setDaysSinceWeight] = useState<number | null>(null);
  const [nextFight, setNextFight] = useState<FightRow | null>(null);
  const [nextWeighIn, setNextWeighIn] = useState<FightRow | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const isPro = mode === 'pro';
      const [today, { data: plan }, { data: wRows }, fightRes] = await Promise.all([
        // La regla de "qué está pendiente" es compartida y vive en un solo
        // sitio: aquí no se vuelve a decidir, se pinta lo que devuelve.
        loadTodayTraining(profile.id, ['strength', 'activity']),
        supabase.from('objective_plans').select('id')
          .eq('fighter_profile_id', profile.id).eq('status', 'active').limit(1).maybeSingle(),
        supabase.from('weight_entries').select('entry_date')
          .eq('fighter_profile_id', profile.id).order('entry_date', { ascending: false }).limit(1),
        isPro
          ? supabase.from('planned_events').select('event_date, title, kind')
              .eq('fighter_profile_id', profile.id).in('kind', ['fight', 'weigh_in'])
              .gte('event_date', todayISO()).order('event_date', { ascending: true })
          : Promise.resolve({ data: null, error: null } as { data: FightRow[] | null; error: null }),
      ]);
      if (!alive) return;

      const describe = (b: PlannedEntry): TrainToday => {
        if (b.kind === 'strength') {
          const p = b.payload as StrengthPayload;
          const exLine = exerciseLines(p.exercises, t).join(' · ');
          return {
            icon: KIND_META.strength.icon,
            title: p.routine_name
              || (p.groups || []).map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })).join(' + ')
              || t('mc_dp_kind_strength'),
            note: exLine || p.note || null,
          };
        }
        const p = b.payload as ActivityPayload;
        const cfg = activityKindCfg(p.kind);
        return {
          icon: cfg.icon,
          title: p.protocol_name || t(cfg.labelKey),
          note: p.note || null,
          actKind: p.kind,
        };
      };
      setPendStr(today.pendingStrength.map(describe));
      setPendAct(today.pendingActivity.map(describe));
      // "Pierna", "Pierna + Correr": lo entrenado hoy, para confirmarlo.
      const doneBits = [
        ...today.trainedGroups.map((g) => t(`mc_str_mg_${g}`, { defaultValue: g })),
        ...today.trainedKinds.map((k) => t(activityKindCfg(k).labelKey)),
      ].filter(Boolean);
      setDoneLabel(doneBits.length > 0 ? doneBits.join(' + ') : (today.trainedToday ? t('mc_dp_kind_strength') : null));

      setHasPlan(!!plan);

      const lastW = (wRows || [])[0] as { entry_date: string } | undefined;
      setDaysSinceWeight(lastW ? -dayDelta(lastW.entry_date) : null);

      const fr = (fightRes.data || []) as FightRow[];
      setNextFight(fr.find((r) => r.kind === 'fight') || null);
      setNextWeighIn(fr.find((r) => r.kind === 'weigh_in') || null);

      setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile.id, mode, t, refreshKey]);

  if (loading) {
    // Esqueleto con la forma de la PhotoCard: chip arriba, titular abajo y
    // botón, para que al llegar los datos no salte el layout.
    return (
      <div className="rk-card" style={{ minHeight: 210, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} role="status" aria-busy="true">
        <SkeletonBox width={110} height={22} radius={999} />
        <div>
          <SkeletonBox width="65%" height={26} />
          <SkeletonBox width="85%" height={12} style={{ marginTop: 10 }} />
          <SkeletonBox width="100%" height={48} radius={14} style={{ marginTop: 16 }} />
        </div>
      </div>
    );
  }

  const pill = (text: string, tone: 'accent' | 'ghost' = 'accent') => (
    <span style={{
      background: tone === 'accent' ? 'var(--accent)' : 'rgba(255,255,255,0.14)',
      color: '#fff',
      borderRadius: 'var(--r-pill)', padding: '4px 12px', fontSize: 12, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{text}</span>
  );

  const cta = (label: string, icon: string, onClick: () => void) => (
    <button onClick={onClick} className="rk-cta rk-press w-full flex items-center justify-center gap-2" style={{ minHeight: 48 }}>
      <i className={`${icon} text-lg`} /> {label}
    </button>
  );

  const fightDays = nextFight ? dayDelta(nextFight.event_date) : null;

  // ── Estado 1: combate próximo (PRO, ≤7 días) ──
  if (mode === 'pro' && nextFight && fightDays != null && fightDays >= 0 && fightDays <= 7) {
    const sub = nextWeighIn
      ? t('mc_hoy_fight_weighin', { date: new Date(nextWeighIn.event_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long' }) })
      : t('mc_hoy_fight_desc');
    return (
      <PhotoCard
        primary
        image="/images/sparring.webp"
        icon="ri-sword-line"
        chips={pill(fightDays <= 0 ? t('mc_hoy_fight_today') : t('mc_hoy_fight_in', { n: fightDays }))}
        title={nextFight.title.toUpperCase()}
        subtitle={sub}
        footer={cta(t('mc_hoy_fight_cta'), 'ri-focus-3-line', onStart)}
      />
    );
  }

  // ── Estado 2: queda algo por hacer hoy ──
  //
  // Solo se pinta con una entrada PLANIFICADA y sin completar. En cualquier
  // otro caso no hay tarjeta de entreno: ni "ya entrenaste", ni sugerencia, ni
  // sustituto. Se cae a los estados que no hablan de entrenar (peso) o a nada.
  //
  // Fuerza y Actividad son DOS tarjetas separadas y cada una lleva a SU
  // sección, no a la Agenda: el usuario que ve "hoy toca correr" quiere el
  // formulario de actividad, no un calendario.
  if (pendStr.length > 0 || pendAct.length > 0) {
    /** Una tarjeta de pendiente. `extra` es el "+N" DENTRO de su propio tipo. */
    const card = (
      x: TrainToday, extra: number, image: string,
      chipKey: string, ctaKey: string, onGo: () => void,
    ) => (
      <PhotoCard
        primary
        image={image}
        icon={x.icon}
        chips={<>
          {pill(t(chipKey))}
          {extra > 0 && pill(`+${extra}`, 'ghost')}
        </>}
        title={x.title.toUpperCase()}
        subtitle={x.note || t('mc_hoy_pending_desc')}
        footer={cta(t(ctaKey), 'ri-play-fill', onGo)}
      />
    );

    return (
      <div className="space-y-4">
        {pendStr.length > 0 && card(
          pendStr[0], pendStr.length - 1, '/images/fuerza.webp',
          'mc_hoy_p_str', 'mc_hoy_p_cta_str', onGoStrength,
        )}
        {pendAct.length > 0 && card(
          pendAct[0], pendAct.length - 1, '/images/correr.webp',
          'mc_hoy_p_act', 'mc_hoy_p_cta_act', () => onLogToday(pendAct[0].actKind),
        )}
      </div>
    );
  }

  // ── Estado 3: peso sin registrar (≥4 días) ──
  if (daysSinceWeight != null && daysSinceWeight >= 4) {
    return (
      <PhotoCard
        primary
        art="weight"
        icon="ri-scales-2-line"
        chips={pill(t('mc_hoy_weight_chip'))}
        title={t('mc_hoy_weight_title').toUpperCase()}
        subtitle={t('mc_hoy_weight_desc', { n: daysSinceWeight })}
        footer={cta(t('mc_hoy_weight_cta'), 'ri-scales-2-line', onLogWeight)}
      />
    );
  }

  // ── Estado 4: hoy ya se ha entrenado y no queda nada planificado ──
  //
  // Confirmación, no CTA. Va DESPUÉS del peso: "ya entrenaste" es información,
  // y pesarse es una acción; lo accionable manda en esta tarjeta. Sin botón
  // rojo: no hay nada que empezar.
  if (doneLabel) {
    return (
      <PhotoCard
        primary
        image="/images/fuerza.webp"
        icon="ri-check-double-line"
        chips={pill(t('mc_hoy_done_chip'))}
        title={t('mc_hoy_done_title', { what: doneLabel }).toUpperCase()}
        subtitle={t('mc_hoy_done_desc')}
        footer={(
          <button onClick={onStart}
            className="rk-nav-btn rk-press w-full flex items-center justify-center gap-2"
            style={{ minHeight: 48 }}>
            <i className="ri-calendar-check-line text-lg" /> {t('mc_hoy_done_cta')}
          </button>
        )}
      />
    );
  }

  // ── Estado 5: plan activo, hoy sin nada planificado (descanso / suelto) ──
  //
  // `() => onLogToday()`, no `onLogToday` a secas: React le pasaría el evento
  // del clic como primer argumento y ese argumento es ahora el TIPO de
  // actividad. Aquí no hay tipo —no hay nada planificado—, así que se llama sin
  // argumentos.
  if (hasPlan) {
    return (
      <PhotoCard
        primary
        art="agenda"
        icon="ri-heart-pulse-line"
        chips={pill(t('mc_hoy_eyebrow'), 'ghost')}
        title={t('mc_hoy_rest_title').toUpperCase()}
        subtitle={t('mc_hoy_rest_desc')}
        footer={cta(t('mc_hoy_rest_cta'), 'ri-add-line', () => onLogToday())}
      />
    );
  }

  // ── Estado 6: sin plan ──
  return (
    <PhotoCard
      primary
      art="agenda"
      icon="ri-sparkling-2-line"
      chips={pill(t('mc_hoy_eyebrow'), 'ghost')}
      title={t('mc_hoy_noplan_title').toUpperCase()}
      subtitle={t('mc_hoy_noplan_desc')}
      footer={cta(t('mc_hoy_create'), 'ri-add-line', onCreatePlan)}
    />
  );
}

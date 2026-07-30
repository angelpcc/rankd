import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import Reveal from '@/components/base/Reveal';

interface Props {
  profile: Profile;
  mode: 'pro' | 'hobby';
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

// Valor de BD → clave i18n compartida (common.ts). semi_pro no casa directo.
const LEVEL_KEY: Record<string, string> = {
  amateur: 'exp_amateur', semi_pro: 'exp_semipro', professional: 'exp_professional',
};

interface Snapshot {
  sessions: number;
  minutes: number;
  activeDays: number;
  fourthValue: number;       // sparrings (pro) o check-ins (hobby)
  checkins: number;
  avgEnergy: number | null;
  sparrings: number;
  sparringRounds: number;
  weightFrom: number | null;
  weightTo: number | null;
  weightTarget: number | null;
  prs: { label: string; weight: number; reps: number }[];
  goals: string[];
  record: string | null;
  disciplineKey: string | null;
  levelKey: string | null;
}

const CARD_W = 1080;
// La altura se calcula según el contenido (ver contentHeight): así nunca se
// recorta nada ni sobra un hueco enorme. Este es el mínimo para que incluso
// una tarjeta escueta tenga buena proporción vertical.
const CARD_MIN_H = 1200;

// Altura exacta que necesita la tarjeta según lo que lleva. Debe cuadrar con los
// avances de dibujo de drawCard (peso 182, marcas 58+52·n, objetivos 46+50·n).
function contentHeight(hasWeight: boolean, prs: number, goals: number): number {
  const y = 840
    + (hasWeight ? 182 : 0)
    + (prs ? 58 + 52 * prs : 0)
    + (goals ? 46 + 50 * goals : 0);
  return Math.max(CARD_MIN_H, y + 96); // 96 = reserva del pie
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 1RM estimado (Epley) para ordenar las marcas por la más fuerte.
function epley(weight: number, reps: number): number {
  return weight * (1 + (reps || 1) / 30);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

// ── Dibujo de la tarjeta compartible ──
interface CardData {
  eyebrow: string;
  name: string;
  sub: string;
  windowLabel: string;
  tiles: { value: string; label: string; color: string }[];
  weightLabel: string;
  weight: { text: string; note: string | null } | null;
  prsHeading: string;
  prsItems: string[];
  goalsHeading: string;
  goalsItems: string[];
  generated: string;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

const bebas = (px: number) => `${px}px "Bebas Neue", system-ui, sans-serif`;
const sans = (w: number, px: number) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

function drawCard(ctx: CanvasRenderingContext2D, d: CardData, H: number) {
  const P = 72;
  // Fondo
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, CARD_W, H);
  // Resplandor rojo arriba a la derecha
  const glow = ctx.createRadialGradient(CARD_W - 60, 40, 20, CARD_W - 60, 40, 520);
  glow.addColorStop(0, 'rgba(225,6,0,0.22)');
  glow.addColorStop(1, 'rgba(225,6,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, 560);

  ctx.textBaseline = 'alphabetic';

  // Wordmark: RANK blanco + D rojo
  ctx.font = bebas(58);
  ctx.fillStyle = '#fff';
  ctx.fillText('RANK', P, 108);
  const rankW = ctx.measureText('RANK').width;
  ctx.fillStyle = '#E10600';
  ctx.fillText('D', P + rankW, 108);

  // Eyebrow
  ctx.font = sans(700, 24);
  ctx.fillStyle = '#E10600';
  ctx.fillText(d.eyebrow.toUpperCase(), P, 152);

  // Nombre
  ctx.font = bebas(88);
  ctx.fillStyle = '#fff';
  ctx.fillText(fit(ctx, d.name.toUpperCase(), CARD_W - 2 * P), P, 268);

  // Subtítulo (disciplina · nivel · récord)
  ctx.font = sans(400, 30);
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(fit(ctx, d.sub, CARD_W - 2 * P), P, 314);

  // Ventana temporal
  ctx.font = sans(400, 26);
  ctx.fillStyle = '#71717a';
  ctx.fillText(d.windowLabel, P, 358);

  // ── Tiles 2×2 ──
  const gap = 24;
  const tileW = (CARD_W - 2 * P - gap) / 2;
  const tileH = 186;
  let ty = 400;
  d.tiles.forEach((tile, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const tx = P + col * (tileW + gap);
    const yy = ty + row * (tileH + gap);
    ctx.fillStyle = '#161618';
    rr(ctx, tx, yy, tileW, tileH, 26);
    ctx.fill();
    ctx.font = bebas(82);
    ctx.fillStyle = tile.color;
    ctx.fillText(fit(ctx, tile.value, tileW - 56), tx + 30, yy + 116);
    ctx.font = sans(500, 26);
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(fit(ctx, tile.label, tileW - 56), tx + 30, yy + tileH - 32);
  });

  let y = ty + 2 * tileH + gap + 44;

  // ── Peso ──
  if (d.weight) {
    const h = 148;
    ctx.fillStyle = '#161618';
    rr(ctx, P, y, CARD_W - 2 * P, h, 26);
    ctx.fill();
    // Etiqueta pequeña
    ctx.font = sans(700, 24);
    ctx.fillStyle = '#4ade80';
    ctx.fillText(d.weightLabel.toUpperCase(), P + 30, y + 50);
    // Valor grande
    ctx.font = bebas(60);
    ctx.fillStyle = '#fff';
    ctx.fillText(fit(ctx, d.weight.text, CARD_W - 2 * P - 380), P + 30, y + 110);
    // Nota (objetivo), alineada a la derecha
    if (d.weight.note) {
      ctx.textAlign = 'right';
      ctx.font = sans(400, 26);
      ctx.fillStyle = '#71717a';
      ctx.fillText(fit(ctx, d.weight.note, 340), CARD_W - P - 30, y + 100);
      ctx.textAlign = 'left';
    }
    y += h + 34;
  }

  // ── Marcas personales ──
  if (d.prsItems.length) {
    ctx.font = sans(700, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(d.prsHeading.toUpperCase(), P, y + 4);
    y += 46;
    ctx.font = sans(400, 30);
    d.prsItems.forEach((it) => {
      ctx.fillStyle = '#C9A84C';
      ctx.fillText('•', P, y);
      ctx.fillStyle = '#d4d4d8';
      ctx.fillText(fit(ctx, it, CARD_W - 2 * P - 34), P + 34, y);
      y += 52;
    });
    y += 12;
  }

  // ── Objetivos ──
  if (d.goalsItems.length) {
    ctx.font = sans(700, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(d.goalsHeading.toUpperCase(), P, y + 4);
    y += 46;
    ctx.font = sans(400, 30);
    d.goalsItems.forEach((it) => {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('•', P, y);
      ctx.fillStyle = '#d4d4d8';
      ctx.fillText(fit(ctx, it, CARD_W - 2 * P - 34), P + 34, y);
      y += 50;
    });
  }

  // ── Pie ──
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(P, H - 92);
  ctx.lineTo(CARD_W - P, H - 92);
  ctx.stroke();
  ctx.font = sans(400, 24);
  ctx.fillStyle = '#71717a';
  ctx.fillText(d.generated, P, H - 54);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a1a1aa';
  ctx.font = bebas(30);
  ctx.fillText('RANKD', CARD_W - P, H - 50);
  ctx.textAlign = 'left';
}

/**
 * Exportar el progreso para el entrenador o promotor.
 *
 * Genera una tarjeta con los datos reales de Mi Esquina (entrenos, peso, marcas,
 * objetivos) y la comparte como IMAGEN por el menú nativo del móvil —que es como
 * de verdad se manda al entrenador por WhatsApp— con copia de texto y descarga
 * como alternativa. Nada sale de aquí salvo que el propio peleador lo envíe.
 */
export default function ShareProgress({ profile, mode, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [windowDays, setWindowDays] = useState<30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const since = isoDaysAgo(windowDays);

    // Cada consulta degrada sola: si su tabla no existe (migración pendiente),
    // ese bloque simplemente se omite y el resto de la tarjeta se genera igual.
    const rows = async <T,>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> => {
      const { data, error } = await q;
      return error ? [] : ((data as T[] | null) || []);
    };
    const one = async <T,>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T | null> => {
      const { data } = await q;
      return (data as T | null) ?? null;
    };

    const [fighter, sessions, weights, goalRow, strength, sparring, checkins, goals] = await Promise.all([
      one<{ discipline: string | null; experience_level: string | null; wins: number | null; losses: number | null; draws: number | null; kos: number | null }>(
        supabase.from('fighters').select('discipline, experience_level, wins, losses, draws, kos').eq('profile_id', profile.id).maybeSingle()),
      rows<{ duration_min: number | null; session_date: string }>(
        supabase.from('training_sessions').select('duration_min, session_date').eq('fighter_profile_id', profile.id).gte('session_date', since)),
      rows<{ weight_kg: number; entry_date: string }>(
        supabase.from('weight_entries').select('weight_kg, entry_date').eq('fighter_profile_id', profile.id).gte('entry_date', since).order('entry_date', { ascending: true })),
      one<{ target_weight_kg: number | null }>(
        supabase.from('nutrition_goals').select('target_weight_kg').eq('fighter_profile_id', profile.id).maybeSingle()),
      rows<{ exercise_label: string; weight_kg: number; reps: number }>(
        supabase.from('strength_sets').select('exercise_label, weight_kg, reps').eq('fighter_profile_id', profile.id).gte('session_date', since)),
      rows<{ rounds: number }>(
        supabase.from('sparring_sessions').select('rounds').eq('fighter_profile_id', profile.id).gte('session_date', since)),
      rows<{ energy: number }>(
        supabase.from('daily_checkins').select('energy').eq('fighter_profile_id', profile.id).gte('entry_date', since)),
      rows<{ title: string; category: string; target_value: number | null; unit: string | null; deadline: string | null }>(
        supabase.from('fighter_goals').select('title, category, target_value, unit, deadline').eq('fighter_profile_id', profile.id).eq('status', 'active').limit(3)),
    ]);

    const minutes = sessions.reduce((a, s) => a + (s.duration_min || 0), 0);
    const activeDays = new Set(sessions.map((s) => s.session_date)).size;
    const avgEnergy = checkins.length ? checkins.reduce((a, c) => a + (c.energy || 0), 0) / checkins.length : null;
    const sparringRounds = sparring.reduce((a, s) => a + (s.rounds || 0), 0);

    // Marcas: mejor set por ejercicio (por 1RM estimado), top 3.
    const bestByExercise = new Map<string, { label: string; weight: number; reps: number; rm: number }>();
    strength.forEach((s) => {
      const key = (s.exercise_label || '').trim().toLowerCase();
      if (!key) return;
      const rm = epley(s.weight_kg, s.reps);
      const cur = bestByExercise.get(key);
      if (!cur || rm > cur.rm) bestByExercise.set(key, { label: s.exercise_label.trim(), weight: s.weight_kg, reps: s.reps, rm });
    });
    const prs = [...bestByExercise.values()].sort((a, b) => b.rm - a.rm).slice(0, 3)
      .map((p) => ({ label: p.label, weight: p.weight, reps: p.reps }));

    // Objetivos con fecha → texto legible (mismo criterio que el Coach IA).
    const goalTexts = goals.slice(0, 2).map((g) => {
      const target = g.target_value !== null ? `${g.target_value}${g.unit || ''}` : null;
      const base = g.category === 'weight' && target ? `${t('mc_share_reach')} ${target}` : g.title;
      return g.deadline ? `${base} (${g.deadline})` : base;
    });

    const record = fighter
      ? `${fighter.wins ?? 0}-${fighter.losses ?? 0}-${fighter.draws ?? 0}${fighter.kos ? ` · ${fighter.kos} KO` : ''}`
      : null;

    setSnap({
      sessions: sessions.length,
      minutes,
      activeDays,
      fourthValue: mode === 'pro' ? sparring.length : checkins.length,
      checkins: checkins.length,
      avgEnergy,
      sparrings: sparring.length,
      sparringRounds,
      weightFrom: weights.length ? weights[0].weight_kg : null,
      weightTo: weights.length ? weights[weights.length - 1].weight_kg : null,
      weightTarget: goalRow?.target_weight_kg ?? null,
      prs,
      goals: goalTexts,
      record,
      disciplineKey: fighter?.discipline ? `disc_${fighter.discipline}` : null,
      levelKey: fighter?.experience_level ? (LEVEL_KEY[fighter.experience_level] || null) : null,
    });
    setLoading(false);
  }, [profile, windowDays, mode, t]);

  useEffect(() => { load(); }, [load]);

  const hasData = !!snap && (snap.sessions > 0 || snap.weightTo !== null || snap.prs.length > 0 || snap.goals.length > 0 || snap.fourthValue > 0 || snap.checkins > 0);

  // Texto plano compartible (para "copiar" y como cuerpo del share nativo).
  const buildText = useCallback((s: Snapshot): string => {
    const name = (profile.full_name || 'RANKD').trim();
    const bits: string[] = [];
    bits.push(`${t('mc_share_eyebrow')} · RANKD`);
    const subParts = [
      s.disciplineKey ? t(s.disciplineKey) : null,
      s.levelKey ? t(s.levelKey) : null,
      s.record,
    ].filter(Boolean);
    bits.push(`${name}${subParts.length ? ' — ' + subParts.join(' · ') : ''}`);
    bits.push(t('mc_share_window', { n: windowDays }));
    bits.push('');
    bits.push(`• ${t('mc_share_stat_sessions')}: ${s.sessions} (${s.minutes} min)`);
    bits.push(`• ${t('mc_share_stat_days')}: ${s.activeDays}`);
    if (s.checkins > 0) bits.push(`• ${t('mc_share_stat_checkins')}: ${s.checkins}${s.avgEnergy !== null ? ` · ${t('mc_share_energy')} ${s.avgEnergy.toFixed(1)}/5` : ''}`);
    if (mode === 'pro' && s.sparrings > 0) bits.push(`• ${t('mc_share_stat_sparrings')}: ${s.sparrings} (${s.sparringRounds} ${t('mc_share_rounds')})`);
    if (s.weightTo !== null) {
      const line = s.weightFrom !== null && s.weightFrom !== s.weightTo ? `${s.weightFrom} → ${s.weightTo} kg` : `${s.weightTo} kg`;
      bits.push(`• ${t('mc_share_weight')}: ${line}${s.weightTarget !== null ? ` (${t('mc_share_target')} ${s.weightTarget} kg)` : ''}`);
    }
    if (s.prs.length) {
      bits.push('');
      bits.push(`${t('mc_share_prs')}:`);
      s.prs.forEach((p) => bits.push(`- ${p.label}: ${p.weight} kg × ${p.reps}`));
    }
    if (s.goals.length) {
      bits.push('');
      bits.push(`${t('mc_share_goals')}:`);
      s.goals.forEach((g) => bits.push(`- ${g}`));
    }
    bits.push('');
    bits.push(`${t('mc_share_generated', { date: new Date().toLocaleDateString(locale) })} · rankd`);
    return bits.join('\n');
  }, [profile.full_name, t, windowDays, mode, locale]);

  // Redibuja la tarjeta cada vez que cambian los datos o el idioma.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snap || !hasData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let cancelled = false;

    const name = (profile.full_name || 'RANKD').trim();
    const subParts = [
      snap.disciplineKey ? t(snap.disciplineKey) : null,
      snap.levelKey ? t(snap.levelKey) : null,
      snap.record,
    ].filter(Boolean) as string[];

    const tiles = [
      { value: String(snap.sessions), label: t('mc_share_stat_sessions'), color: '#E10600' },
      { value: String(snap.minutes), label: t('mc_share_stat_minutes'), color: '#38bdf8' },
      { value: String(snap.activeDays), label: t('mc_share_stat_days'), color: '#4ade80' },
      {
        value: String(snap.fourthValue),
        label: mode === 'pro' ? t('mc_share_stat_sparrings') : t('mc_share_stat_checkins'),
        color: '#C9A84C',
      },
    ];

    let weight: CardData['weight'] = null;
    if (snap.weightTo !== null) {
      const text = snap.weightFrom !== null && snap.weightFrom !== snap.weightTo
        ? `${snap.weightFrom} → ${snap.weightTo} kg`
        : `${snap.weightTo} kg`;
      weight = {
        text,
        note: snap.weightTarget !== null ? `${t('mc_share_target')}: ${snap.weightTarget} kg` : null,
      };
    }

    const card: CardData = {
      eyebrow: t('mc_share_eyebrow'),
      name,
      sub: subParts.join('  ·  '),
      windowLabel: t('mc_share_window', { n: windowDays }),
      tiles,
      weightLabel: t('mc_share_weight'),
      weight,
      prsHeading: t('mc_share_prs'),
      prsItems: snap.prs.map((p) => `${p.label} — ${p.weight} kg × ${p.reps}`),
      goalsHeading: t('mc_share_goals'),
      goalsItems: snap.goals,
      generated: t('mc_share_generated', { date: new Date().toLocaleDateString(locale) }),
    };

    const H = contentHeight(!!card.weight, card.prsItems.length, card.goalsItems.length);
    const run = async () => {
      try { await document.fonts.ready; } catch { /* fallback a la fuente del sistema */ }
      if (cancelled) return;
      // Redimensionar el canvas lo limpia; dibujamos justo después.
      canvas.width = CARD_W;
      canvas.height = H;
      drawCard(ctx, card, H);
    };
    run();
    return () => { cancelled = true; };
  }, [snap, hasData, t, locale, windowDays, mode, profile.full_name]);

  const doShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !snap) return;
    setBusy(true);
    try {
      const blob = await canvasToBlob(canvas);
      if (!blob) { showToast(t('mc_share_fail'), 'error'); return; }
      const file = new File([blob], 'rankd-progreso.png', { type: 'image/png' });
      const text = buildText(snap);
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({ files: [file], title: t('mc_share_share_title'), text });
        } catch (err) {
          // El usuario cancela el menú → no es un fallo.
          if ((err as Error)?.name !== 'AbortError') { downloadBlob(blob); }
        }
      } else {
        downloadBlob(blob);
        showToast(t('mc_share_downloaded'));
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rankd-progreso.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    if (!blob) { showToast(t('mc_share_fail'), 'error'); return; }
    downloadBlob(blob);
    showToast(t('mc_share_downloaded'));
  };

  const doCopy = async () => {
    if (!snap) return;
    try {
      await navigator.clipboard.writeText(buildText(snap));
      showToast(t('mc_share_copied'));
    } catch {
      showToast(t('mc_share_fail'), 'error');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Reveal>
        <div>
          <p className="rk-eyebrow">{t('mc_share_eyebrow')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_share_head')} <span className="rk-red-glow">{t('mc_share_head_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_share_sub')}</p>
        </div>
      </Reveal>

      {/* Ventana temporal */}
      <div className="flex gap-2">
        {([30, 90] as const).map((n) => (
          <button key={n} onClick={() => setWindowDays(n)}
            className={`px-4 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${windowDays === n ? 'bg-red-600 text-white border-red-600' : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-white/25'}`}
            style={{ minHeight: 44 }}>
            {t('mc_share_window', { n })}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rk-card flex items-center justify-center" style={{ height: 420, transform: 'none' }}>
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !hasData ? (
        <div className="rk-card text-center" style={{ padding: '44px 26px', transform: 'none' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-share-forward-line text-3xl text-zinc-500"></i>
          </div>
          <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{t('mc_share_empty_title')}</h3>
          <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">{t('mc_share_empty_desc')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
          {/* Vista previa = exactamente lo que se comparte */}
          <div className="mx-auto md:mx-0">
            <canvas ref={canvasRef} width={CARD_W} height={CARD_MIN_H}
              className="rounded-2xl border border-white/10 shadow-xl w-full"
              style={{ maxWidth: 320, height: 'auto', display: 'block' }} />
          </div>

          {/* Acciones */}
          <div className="space-y-3">
            <button onClick={doShare} disabled={busy}
              className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.9rem', padding: '0.8rem 1.4rem' }}>
              <i className="ri-share-forward-fill"></i>{busy ? t('mc_share_working') : t('mc_share_btn_share')}
            </button>
            <button onClick={doDownload} disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-white/12 hover:border-white/30 text-white text-sm py-3 transition-colors cursor-pointer disabled:opacity-60">
              <i className="ri-download-2-line"></i>{t('mc_share_btn_download')}
            </button>
            <button onClick={doCopy} disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-white/12 hover:border-white/30 text-zinc-300 text-sm py-3 transition-colors cursor-pointer disabled:opacity-60">
              <i className="ri-file-copy-line"></i>{t('mc_share_btn_copy')}
            </button>

            <p className="text-[11px] text-zinc-500 leading-relaxed flex items-start gap-1.5 pt-1">
              <i className="ri-lock-line mt-0.5 flex-shrink-0"></i>
              {t('mc_share_privacy')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

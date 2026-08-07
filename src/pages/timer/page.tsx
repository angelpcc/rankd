import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isViewingAs } from '@/lib/viewAs';
import { useSEO } from '@/hooks/useSEO';
import TimerSetup from './components/TimerSetup';
import TimerRunner from './components/TimerRunner';
import {
  DEFAULT_CONFIG, fmt, loadCustomCombos, loadPresets, saveCustomCombos, savePresets,
  buildSchedule, type CustomCombo, type Discipline, type Preset, type RoundCombo, type TimerConfig,
} from './lib/session';
import { comboById } from './lib/combos';
import { timerSounds, armTimerAudio } from './lib/sounds';

// fighters.discipline puede traer valores fuera de nuestro conjunto (bjj,
// wrestling...): solo prefiltramos cuando encaja con una disciplina con combos.
const DISC_MAP: Record<string, Discipline> = {
  boxing: 'boxing', mma: 'mma', kickboxing: 'kickboxing', muay_thai: 'muay_thai',
};

export default function TimerPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<'setup' | 'run'>('setup');
  const [config, setConfig] = useState<TimerConfig>(() => ({ ...DEFAULT_CONFIG, combos: [] }));
  const [muted, setMuted] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [customCombos, setCustomCombos] = useState<CustomCombo[]>([]);
  const [discipline, setDiscipline] = useState<Discipline | undefined>();
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiChecking, setAiChecking] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useSEO({ title: 'Temporizador | RANKD', description: 'Temporizador de asaltos con cambios de ritmo y biblioteca de combinaciones.' });

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => { if (!authLoading && !user && !isViewingAs()) navigate('/esquina'); }, [authLoading, user, navigate]);

  // Desbloquea el audio con la PRIMERA interacción del usuario en la página.
  // Los navegadores (sobre todo iOS Safari) bloquean el sonido hasta que hay un
  // gesto; sin esto el temporizador arrancaría mudo. Ver lib/sounds.ts.
  useEffect(() => armTimerAudio(), []);

  // Preajustes y combinaciones propias (local).
  useEffect(() => { setPresets(loadPresets()); setCustomCombos(loadCustomCombos()); }, []);

  // Disciplina del peleador → filtro por defecto de la biblioteca.
  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('fighters').select('discipline').eq('profile_id', profile.id).maybeSingle()
      .then(({ data }) => { if (data?.discipline && DISC_MAP[data.discipline]) setDiscipline(DISC_MAP[data.discipline]); });
  }, [profile?.id]);

  // Disponibilidad de la IA (misma sonda que el resto de asistentes).
  useEffect(() => {
    let alive = true;
    fetch('/api/coach', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => { if (alive) setAiAvailable(!!d?.available); })
      .catch(() => { if (alive) setAiAvailable(false); })
      .finally(() => { if (alive) setAiChecking(false); });
    return () => { alive = false; };
  }, []);

  // ── Persistencia de preajustes / combos ──
  const addPreset = (p: Preset) => { const next = [p, ...presets]; setPresets(next); savePresets(next); };
  const removePreset = (id: string) => { const next = presets.filter((x) => x.id !== id); setPresets(next); savePresets(next); };
  const addCustom = (c: CustomCombo) => { const next = [c, ...customCombos]; setCustomCombos(next); saveCustomCombos(next); };
  const removeCustom = (id: string) => { const next = customCombos.filter((x) => x.id !== id); setCustomCombos(next); saveCustomCombos(next); };

  // ── IA: reparte una combinación por asalto y las carga en el temporizador ──
  const onAiGenerate = useCallback(async (prompt: string): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          section: 'training',
          timerCombos: { rounds: config.rounds, discipline, prompt },
          messages: [{ role: 'user', content: prompt || `Prepárame ${config.rounds} asaltos con una combinación distinta para cada uno.` }],
        }),
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      const list: string[] = Array.isArray(data.combos) ? data.combos : [];
      if (list.length === 0) return false;
      const combos: RoundCombo[] = [];
      for (let i = 0; i < config.rounds; i++) {
        const text = list[i % list.length];
        combos[i] = text ? { kind: 'custom', text } : null;
      }
      setConfig((c) => ({ ...c, combos }));
      return true;
    } catch { return false; }
  }, [config.rounds, discipline]);

  // ── Guardado en el diario de entrenos (Tarea 9) ──
  const onSaveToDiary = useCallback(async (): Promise<boolean> => {
    if (!profile?.id) return false;
    const sched = buildSchedule(config);
    const bursts = sched.reduce((a, s) => a + s.bursts.length, 0);
    const workMin = Math.round((config.rounds * config.roundSec) / 60);

    // Combinaciones trabajadas → texto legible para las notas.
    const comboTexts = config.combos.map((rc) => {
      if (!rc) return null;
      if (rc.kind === 'library') return comboById(rc.comboId)?.moves.map((m) => t(`tm_move_${m}`, m)).join(' ') || null;
      return rc.text;
    }).filter(Boolean) as string[];

    const noteParts = [
      `${t('tm_note_prefix')}: ${t('tm_note_rounds', { rounds: config.rounds, dur: fmt(config.roundSec) })}`,
      bursts > 0 ? t('tm_note_bursts', { n: bursts }) : null,
      comboTexts.length ? t('tm_note_combos', { list: comboTexts.slice(0, 6).join(' · ') }) : null,
    ].filter(Boolean);

    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const { error } = await supabase.from('training_sessions').insert({
      fighter_profile_id: profile.id,
      session_date: iso,
      session_type: comboTexts.length ? 'tecnica' : 'cardio',
      duration_min: workMin || null,
      intensity: config.burst.enabled ? 4 : 3,
      notes: noteParts.join(' · ').slice(0, 500) || null,
    });
    if (error) { showToast(t('tm_save_error'), 'error'); return false; }
    showToast(t('tm_saved_diary'));
    return true;
  }, [config, profile?.id, t, showToast]);

  if (authLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {phase === 'setup' ? (
        <TimerSetup
          config={config}
          onConfig={setConfig}
          onStart={() => { timerSounds.muted = muted; timerSounds.unlock(); setPhase('run'); }}
          onBack={() => navigate('/mi-esquina')}
          discipline={discipline}
          presets={presets}
          onSavePreset={addPreset}
          onDeletePreset={removePreset}
          customCombos={customCombos}
          onSaveCustom={addCustom}
          onDeleteCustom={removeCustom}
          aiAvailable={aiAvailable}
          aiChecking={aiChecking}
          onAiGenerate={onAiGenerate}
          showToast={showToast}
        />
      ) : (
        <TimerRunner
          config={config}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onExit={() => setPhase('setup')}
          onSaveToDiary={onSaveToDiary}
        />
      )}

      {/* Aviso */}
      {toast && (
        <div role="status"
          className="anim-fade-up fixed z-[90] left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm text-white text-sm px-4 py-3.5 rounded-2xl flex items-center gap-3"
          style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', background: toast.type === 'error' ? '#dc2626' : '#16a34a' }}>
          <i className={`text-lg ${toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'}`}></i>
          <span className="flex-1 min-w-0 font-semibold leading-snug">{toast.msg}</span>
        </div>
      )}
    </>
  );
}

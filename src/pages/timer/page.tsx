import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { isMissingColumn } from '@/lib/dbState';
import { useAuth } from '@/hooks/useAuth';
import { isViewingAs } from '@/lib/viewAs';
import { useSEO } from '@/hooks/useSEO';
import TimerSetup from './components/TimerSetup';
import TimerRunner from './components/TimerRunner';
import RinconSetup from './components/RinconSetup';
import RinconRunner, { type RinconSummary } from './components/RinconRunner';
import {
  DEFAULT_CONFIG, fmt, loadCustomCombos, loadPresets, saveCustomCombos, savePresets,
  buildSchedule, type CustomCombo, type Discipline, type Preset, type RoundCombo, type TimerConfig,
} from './lib/session';
import { comboById } from './lib/combos';
import { boxingSummary, loadBoxingById, toTimerConfig, touchBoxingSession, type BoxingSession } from '@/pages/mi-esquina/lib/boxing';
import { timerSounds, armTimerAudio } from './lib/sounds';
import {
  RINCON_FACTORY_COMBOS, DEFAULT_RINCON_CONFIG,
  loadCustomCombos as loadRinconCombos, saveCustomCombos as saveRinconCombos,
  loadRinconPresets, saveRinconPresets, loadRinconConfig, saveRinconConfig,
  loadTimerMode, saveTimerMode,
  type RinconCombo, type RinconConfig, type RinconPreset, type TimerMode,
} from './lib/rincon';

// fighters.discipline puede traer valores fuera de nuestro conjunto (bjj,
// wrestling...): solo prefiltramos cuando encaja con una disciplina con combos.
const DISC_MAP: Record<string, Discipline> = {
  boxing: 'boxing', mma: 'mma', kickboxing: 'kickboxing', muay_thai: 'muay_thai',
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TimerPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<TimerMode>(() => loadTimerMode());
  const [phase, setPhase] = useState<'setup' | 'run'>('setup');
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Entreno de boxeo generado que llega ya preparado (punto 28) ──
  //
  // Se recibe por la URL (?session=<id>) y no por el estado de navegación
  // adrede: así el enlace funciona desde cualquier sitio —el bloque de la
  // Agenda, un acceso directo, recargar la página— y no se pierde al refrescar,
  // que es justo lo que pasaría con location.state.
  const [searchParams] = useSearchParams();
  const boxingId = searchParams.get('session');
  const [boxing, setBoxing] = useState<BoxingSession | null>(null);
  // El guion empieza plegado: con 8 o 10 asaltos, desplegado empuja fuera de
  // la pantalla del móvil justo lo que hay que tocar para empezar.
  const [verGuion, setVerGuion] = useState(false);

  // ── Estado del temporizador clásico ──
  const [config, setConfig] = useState<TimerConfig>(() => ({ ...DEFAULT_CONFIG, combos: [] }));
  const [presets, setPresets] = useState<Preset[]>([]);
  const [customCombos, setCustomCombos] = useState<CustomCombo[]>([]);
  const [discipline, setDiscipline] = useState<Discipline | undefined>();
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiChecking, setAiChecking] = useState(true);

  // ── Estado de "El Rincón" ──
  const [rinconConfig, setRinconConfig] = useState<RinconConfig>(() => loadRinconConfig());
  const [rinconCustom, setRinconCustom] = useState<RinconCombo[]>([]);
  const [rinconPresets, setRinconPresets] = useState<RinconPreset[]>([]);
  const rinconCombos: RinconCombo[] = [...RINCON_FACTORY_COMBOS, ...rinconCustom];

  useSEO({ title: 'Temporizador | RANKD', description: 'Temporizador de asaltos con cambios de ritmo y combinaciones cantadas por voz.' });

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => { if (!authLoading && !user && !isViewingAs()) navigate('/esquina'); }, [authLoading, user, navigate]);
  useEffect(() => armTimerAudio(), []);
  useEffect(() => { setPresets(loadPresets()); setCustomCombos(loadCustomCombos()); }, []);
  useEffect(() => { setRinconCustom(loadRinconCombos()); setRinconPresets(loadRinconPresets()); }, []);
  useEffect(() => { saveRinconConfig(rinconConfig); }, [rinconConfig]);

  // Cargar el entreno de boxeo pedido por la URL y dejar el temporizador listo.
  // Solo se toca la configuración: NO se arranca solo. Empezar a contar sin que
  // nadie lo haya pedido te deja peleando con el móvil mientras suena la
  // campana — la decisión de empezar es del usuario, siempre.
  useEffect(() => {
    if (!boxingId || !profile?.id) return;
    let alive = true;
    loadBoxingById(profile.id, boxingId).then((s) => {
      if (!alive || !s) return;
      setBoxing(s);
      setConfig(toTimerConfig(s));
      setMode('classic');
      saveTimerMode('classic');
      setPhase('setup');
    });
    return () => { alive = false; };
  }, [boxingId, profile?.id]);

  const changeMode = (m: TimerMode) => { setMode(m); saveTimerMode(m); setPhase('setup'); };

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('fighters').select('discipline').eq('profile_id', profile.id).maybeSingle()
      .then(({ data }) => { if (data?.discipline && DISC_MAP[data.discipline]) setDiscipline(DISC_MAP[data.discipline]); });
  }, [profile?.id]);

  useEffect(() => {
    let alive = true;
    fetch('/api/coach', { method: 'GET' })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => { if (alive) setAiAvailable(!!d?.available); })
      .catch(() => { if (alive) setAiAvailable(false); })
      .finally(() => { if (alive) setAiChecking(false); });
    return () => { alive = false; };
  }, []);

  // ── Persistencia clásica ──
  const addPreset = (p: Preset) => { const next = [p, ...presets]; setPresets(next); savePresets(next); };
  const removePreset = (id: string) => { const next = presets.filter((x) => x.id !== id); setPresets(next); savePresets(next); };
  const addCustom = (c: CustomCombo) => { const next = [c, ...customCombos]; setCustomCombos(next); saveCustomCombos(next); };
  const removeCustom = (id: string) => { const next = customCombos.filter((x) => x.id !== id); setCustomCombos(next); saveCustomCombos(next); };

  // ── Persistencia "El Rincón" ──
  const addRinconCombo = (c: RinconCombo) => { const next = [c, ...rinconCustom]; setRinconCustom(next); saveRinconCombos(next); };
  const updateRinconCombo = (c: RinconCombo) => { const next = rinconCustom.map((x) => (x.id === c.id ? c : x)); setRinconCustom(next); saveRinconCombos(next); };
  const removeRinconCombo = (id: string) => {
    const next = rinconCustom.filter((x) => x.id !== id);
    setRinconCustom(next); saveRinconCombos(next);
    setRinconConfig((cfg) => ({ ...cfg, comboIds: cfg.comboIds.filter((x) => x !== id) }));
  };
  const addRinconPreset = (p: RinconPreset) => { const next = [p, ...rinconPresets]; setRinconPresets(next); saveRinconPresets(next); };
  const removeRinconPreset = (id: string) => { const next = rinconPresets.filter((x) => x.id !== id); setRinconPresets(next); saveRinconPresets(next); };

  // ── IA: reparte una combinación por asalto (temporizador clásico) ──
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

  // ── Guardado en el diario de entrenos (temporizador clásico) ──
  const onSaveToDiary = useCallback(async (): Promise<boolean> => {
    if (!profile?.id) return false;

    // ── Si esto era un entreno de boxeo generado, va a ACTIVIDAD ──
    //
    // El temporizador clásico guarda en el diario (training_sessions), que la
    // Agenda no lee. Un entreno de boxeo que sale de un plan tiene que quedar
    // registrado como lo que es —una actividad de tipo boxeo— para que
    // reconcileDayTicks marque el bloque del día igual que cualquier otra
    // sesión (punto 26). Sin esto, terminabas el entreno y la Agenda seguía
    // pidiéndotelo.
    if (boxing) {
      const iso = todayISO();
      const total = Math.round((boxing.rounds * boxing.roundSec) / 60)
        + boxing.warmupMin + boxing.cooldownMin;
      const fila: Record<string, unknown> = {
        fighter_profile_id: profile.id,
        session_date: iso,
        kind: 'boxeo',
        duration_min: total || null,
        rounds: boxing.rounds,
        round_duration_sec: boxing.roundSec,
        note: boxing.name.slice(0, 200) || null,
      };
      let { error } = await supabase.from('activity_sessions').insert(fila);
      // Bases sin las columnas de asaltos: se reintenta con lo mínimo antes que
      // perder el registro entero.
      if (error && isMissingColumn(error)) {
        ({ error } = await supabase.from('activity_sessions').insert({
          fighter_profile_id: profile.id, session_date: iso, kind: 'boxeo',
          duration_min: fila.duration_min, note: fila.note,
        }));
      }
      if (error) { showToast(t('tm_save_error'), 'error'); return false; }
      void touchBoxingSession(profile.id, boxing.id);
      import('@/pages/mi-esquina/lib/planTicks')
        .then((m) => m.reconcileDayTicks(profile.id, iso))
        .catch(() => { /* migración sin aplicar: da igual */ });
      showToast(t('tm_bx_saved'));
      return true;
    }

    const sched = buildSchedule(config);
    const bursts = sched.reduce((a, s) => a + s.bursts.length, 0);
    const workMin = Math.round((config.rounds * config.roundSec) / 60);
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
    const { error } = await supabase.from('training_sessions').insert({
      fighter_profile_id: profile.id,
      session_date: todayISO(),
      session_type: comboTexts.length ? 'tecnica' : 'cardio',
      duration_min: workMin || null,
      intensity: config.burst.enabled ? 4 : 3,
      notes: noteParts.join(' · ').slice(0, 500) || null,
    });
    if (error) { showToast(t('tm_save_error'), 'error'); return false; }
    showToast(t('tm_saved_diary'));
    return true;
  }, [boxing, config, profile?.id, t, showToast]);

  // ── Guardado de "El Rincón" como sesión de Actividad (kind: boxeo) ──
  const onSaveRincon = useCallback(async (s: RinconSummary): Promise<boolean> => {
    if (!profile?.id) return false;
    const iso = todayISO();
    const note = s.combos.length ? t('tm_rc_note_combos', { list: s.combos.slice(0, 8).join(' · ') }) : null;
    const full: Record<string, unknown> = {
      fighter_profile_id: profile.id,
      session_date: iso,
      kind: 'boxeo',
      duration_min: Math.round(s.workSec / 60) || null,
      rounds: s.rounds,
      round_duration_sec: s.roundSec,
      note,
    };
    let { error } = await supabase.from('activity_sessions').insert(full);
    if (error && isMissingColumn(error)) {
      ({ error } = await supabase.from('activity_sessions').insert({
        fighter_profile_id: profile.id, session_date: iso, kind: 'boxeo',
        duration_min: full.duration_min, rounds: s.rounds, note,
      }));
    }
    if (error) { showToast(t('tm_save_error'), 'error'); return false; }
    // Marca el plan del día si había un bloque de actividad de boxeo planificado.
    import('@/pages/mi-esquina/lib/planTicks')
      .then((m) => m.reconcileDayTicks(profile.id, iso))
      .catch(() => { /* migración sin aplicar: da igual */ });
    showToast(t('tm_rc_saved_activity'));
    return true;
  }, [profile?.id, t, showToast]);

  if (authLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const startClassic = () => { timerSounds.muted = muted; timerSounds.unlock(); setPhase('run'); };
  const startRincon = () => { timerSounds.muted = muted; timerSounds.unlock(); try { window.speechSynthesis?.cancel(); } catch { /* no-op */ } setPhase('run'); };

  return (
    <>
      {mode === 'rincon' ? (
        phase === 'setup' ? (
          <RinconSetup
            mode={mode}
            onMode={changeMode}
            config={rinconConfig}
            onConfig={setRinconConfig}
            onStart={startRincon}
            onBack={() => navigate('/mi-esquina')}
            combos={rinconCombos}
            onSaveCustom={addRinconCombo}
            onUpdateCustom={updateRinconCombo}
            onDeleteCustom={removeRinconCombo}
            presets={rinconPresets}
            onSavePreset={addRinconPreset}
            onDeletePreset={removeRinconPreset}
            showToast={showToast}
          />
        ) : (
          <RinconRunner
            config={rinconConfig}
            combos={rinconCombos}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onExit={() => setPhase('setup')}
            onSaveActivity={onSaveRincon}
          />
        )
      ) : phase === 'setup' ? (
        <>
        {/* ── Qué entreno se ha cargado ──
            Sin esto el temporizador aparece con 8 asaltos de 2 minutos puestos
            y no dice de dónde salen: parece que se han cambiado solos. Decirlo
            deja claro además que darle a empezar arranca ESE entreno. */}
        {boxing && (
          <div className="mx-auto px-4 pt-4" style={{ maxWidth: 560 }}>
            <div className="rk-card overflow-hidden" style={{ padding: 0, borderColor: 'rgba(225,6,0,0.35)' }}>
              {/* Cabecera: el nombre grande y los números en fila propia. Antes
                  todo iba en texto de 11px gris y no se leía nada en el móvil. */}
              <div className="flex items-center gap-3 p-4">
                <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(225,6,0,0.14)', color: 'var(--accent)' }}>
                  <i className="ri-boxing-line text-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--accent)' }}>
                    {t('tm_bx_loaded')}
                  </p>
                  <p className="text-[15px] font-bold text-white leading-tight truncate">{boxing.name}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                {[
                  boxingSummary(boxing),
                  boxing.warmupMin > 0 ? t('tm_bx_warmup', { n: boxing.warmupMin }) : '',
                  boxing.cooldownMin > 0 ? t('tm_bx_cooldown', { n: boxing.cooldownMin }) : '',
                ].filter(Boolean).map((txt) => (
                  <span key={txt} className="text-[11px] font-semibold text-zinc-300 rounded-lg px-2 py-1"
                    style={{ background: 'rgba(255,255,255,0.05)' }}>{txt}</span>
                ))}
              </div>

              {boxing.script.length > 0 && (
                <>
                  <button type="button" onClick={() => setVerGuion((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer border-t border-white/[0.07] hover:bg-white/[0.03] transition-colors">
                    <span className="text-xs font-bold text-white">
                      {t('tm_bx_script', { n: boxing.script.length })}
                    </span>
                    <i className={`text-zinc-400 ${verGuion ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`} />
                  </button>
                  {verGuion && (
                    <ol className="px-4 pb-4 space-y-2">
                      {boxing.script.map((r) => (
                        <li key={r.round} className="flex gap-2.5">
                          <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg text-[11px] font-bold text-white"
                            style={{ background: 'rgba(225,6,0,0.18)' }}>{r.round}</span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-bold text-white leading-snug">{r.title}</span>
                            {r.work ? <span className="block text-xs text-zinc-400 leading-snug mt-0.5">{r.work}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <TimerSetup
          mode={mode}
          onMode={changeMode}
          config={config}
          onConfig={setConfig}
          onStart={startClassic}
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
        </>
      ) : (
        <TimerRunner
          config={config}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onExit={() => setPhase('setup')}
          onSaveToDiary={onSaveToDiary}
        />
      )}

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

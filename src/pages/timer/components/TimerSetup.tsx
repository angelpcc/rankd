import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FACTORY_PRESETS, fmt, fmtLong, totalSessionSeconds, totalWorkSeconds, uid,
  buildSchedule, type CustomCombo, type Discipline, type Preset, type RoundCombo, type TimerConfig,
} from '../lib/session';
import { roundComboParts } from '../lib/combos';
import { timerSounds } from '../lib/sounds';
import SessionTimeline from './SessionTimeline';
import CombosLibrary from './CombosLibrary';

interface Props {
  config: TimerConfig;
  onConfig: (next: TimerConfig) => void;
  onStart: () => void;
  onBack: () => void;
  discipline?: Discipline;
  presets: Preset[];
  onSavePreset: (p: Preset) => void;
  onDeletePreset: (id: string) => void;
  customCombos: CustomCombo[];
  onSaveCustom: (c: CustomCombo) => void;
  onDeleteCustom: (id: string) => void;
  aiAvailable: boolean;
  aiChecking: boolean;
  onAiGenerate: (prompt: string) => Promise<boolean>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const WARN_OPTIONS = [0, 3, 5, 10, 15];

export default function TimerSetup(props: Props) {
  const {
    config, onConfig, onStart, onBack, discipline, presets,
    onSavePreset, onDeletePreset, customCombos, onSaveCustom, onDeleteCustom,
    aiAvailable, aiChecking, onAiGenerate, showToast,
  } = props;
  const { t } = useTranslation();
  const [libraryFor, setLibraryFor] = useState<number | null | 'browse'>(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const moveLabel = (tok: string) => t(`tm_move_${tok}`, tok);
  const patch = (p: Partial<TimerConfig>) => onConfig({ ...config, ...p });

  // Mantén el array de combinaciones a la longitud de asaltos.
  const combosFor = (i: number): RoundCombo => config.combos[i] ?? null;
  const setCombo = (i: number, rc: RoundCombo) => {
    const next = [...config.combos];
    while (next.length < config.rounds) next.push(null);
    next[i] = rc;
    onConfig({ ...config, combos: next.slice(0, config.rounds) });
  };

  const applyPreset = (p: Pick<Preset, 'rounds' | 'roundSec' | 'restSec' | 'warnSec' | 'burst'>) => {
    onConfig({
      ...config, rounds: p.rounds, roundSec: p.roundSec, restSec: p.restSec,
      warnSec: p.warnSec, burst: { ...p.burst },
      combos: config.combos.slice(0, p.rounds),
    });
  };

  const schedule = buildSchedule(config);
  const roundMin = Math.floor(config.roundSec / 60);
  const roundRemSec = config.roundSec % 60;
  const restMin = Math.floor(config.restSec / 60);
  const restRemSec = config.restSec % 60;

  const setRoundSec = (m: number, s: number) => patch({ roundSec: Math.max(10, m * 60 + s) });
  const setRestSec = (m: number, s: number) => patch({ restSec: Math.max(0, m * 60 + s) });

  const doSavePreset = () => {
    const name = presetName.trim() || `${config.rounds}×${fmt(config.roundSec)}`;
    onSavePreset({ id: uid(), label: name, rounds: config.rounds, roundSec: config.roundSec, restSec: config.restSec, warnSec: config.warnSec, burst: { ...config.burst } });
    setSavingPreset(false); setPresetName('');
    showToast(t('tm_preset_saved'));
  };

  const runAi = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    const ok = await onAiGenerate(aiPrompt.trim());
    setAiLoading(false);
    if (ok) { setAiPrompt(''); showToast(t('tm_ai_loaded')); }
    else showToast(t('tm_ai_error'), 'error');
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white rk-safe-top">
      {/* Barra superior */}
      <div className="sticky top-0 z-30 bg-[#070707]/92 backdrop-blur border-b border-white/8 rk-safe-top">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer">
            <i className="ri-arrow-left-line text-lg"></i>{t('tm_back')}
          </button>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <i className="ri-time-line"></i>{fmtLong(totalSessionSeconds(config))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-32 space-y-7">
        {/* Titular */}
        <div>
          <p className="rk-eyebrow">{t('tm_setup_kicker')}</p>
          <h1 className="rk-h1" style={{ margin: '4px 0 0', color: '#fff' }}>
            {t('tm_setup_title')} <span className="rk-red-glow">{t('tm_setup_title_accent')}</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-md">{t('tm_setup_sub')}</p>
        </div>

        {/* Vista previa de la línea de tiempo */}
        <SessionTimeline schedule={schedule} />

        {/* Resumen numérico */}
        <div className="grid grid-cols-3 gap-3">
          <MiniStat value={String(config.rounds)} label={t('tm_rounds')} />
          <MiniStat value={fmt(config.roundSec)} label={t('tm_round_dur')} color="#E10600" />
          <MiniStat value={config.restSec > 0 ? fmt(config.restSec) : '—'} label={t('tm_rest_dur')} color="#22c55e" />
        </div>

        {/* ── Preajustes ── */}
        <Section icon="ri-flashlight-line" title={t('tm_presets')}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">{t('tm_factory')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FACTORY_PRESETS.map((p) => {
              const active = p.rounds === config.rounds && p.roundSec === config.roundSec && p.restSec === config.restSec;
              return (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className={`text-left rounded-xl border p-3 cursor-pointer transition-all ${active ? 'bg-red-600/12 border-red-500/45' : 'bg-white/[0.03] border-white/10 hover:border-white/25'}`}>
                  <p className={`text-sm font-bold ${active ? 'text-red-400' : 'text-white'}`}>{p.label}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{p.rounds}×{fmt(p.roundSec)} · {p.restSec > 0 ? fmt(p.restSec) : '—'}</p>
                </button>
              );
            })}
          </div>

          {presets.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mt-4 mb-2">{t('tm_my_presets')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {presets.map((p) => (
                  <div key={p.id} className="relative rounded-xl border border-white/10 bg-white/[0.03] p-3 group">
                    <button onClick={() => applyPreset(p)} className="text-left w-full cursor-pointer">
                      <p className="text-sm font-bold text-white pr-5 truncate">{p.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{p.rounds}×{fmt(p.roundSec)} · {p.restSec > 0 ? fmt(p.restSec) : '—'}</p>
                    </button>
                    <button onClick={() => { onDeletePreset(p.id); showToast(t('tm_preset_removed')); }}
                      className="absolute top-2 right-2 text-zinc-600 hover:text-red-400 cursor-pointer">
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {savingPreset ? (
            <div className="flex gap-2 mt-3">
              <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder={t('tm_preset_name_ph')} autoFocus
                className="flex-1 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" />
              <button onClick={doSavePreset} className="rk-btn rk-btn-primary" style={{ fontSize: '0.8rem', padding: '0 1.1rem' }}>{t('tm_save')}</button>
              <button onClick={() => setSavingPreset(false)} className="text-sm text-zinc-500 hover:text-white px-2 cursor-pointer">{t('tm_cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setSavingPreset(true)} className="mt-3 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white cursor-pointer">
              <i className="ri-bookmark-line"></i>{t('tm_save_preset')}
            </button>
          )}
        </Section>

        {/* ── Configuración libre ── */}
        <Section icon="ri-equalizer-line" title={t('tm_cfg_title')} sub={t('tm_cfg_sub')}>
          <div className="space-y-4">
            <Row label={t('tm_rounds')}>
              <Stepper value={config.rounds} min={1} max={99} onChange={(v) => patch({ rounds: v, combos: config.combos.slice(0, v) })} />
            </Row>
            <Row label={t('tm_round_dur')}>
              <div className="flex items-center gap-3">
                <Stepper value={roundMin} min={0} max={30} suffix={t('tm_min')} onChange={(v) => setRoundSec(v, roundRemSec)} />
                <Stepper value={roundRemSec} min={0} max={45} step={15} wrap suffix={t('tm_sec')} onChange={(v) => setRoundSec(roundMin, v)} />
              </div>
            </Row>
            <Row label={t('tm_rest_dur')}>
              <div className="flex items-center gap-3">
                <Stepper value={restMin} min={0} max={10} suffix={t('tm_min')} onChange={(v) => setRestSec(v, restRemSec)} />
                <Stepper value={restRemSec} min={0} max={45} step={5} wrap suffix={t('tm_sec')} onChange={(v) => setRestSec(restMin, v)} />
              </div>
            </Row>
            <Row label={t('tm_warn')}>
              <div className="flex gap-1.5 flex-wrap">
                {WARN_OPTIONS.map((w) => (
                  <button key={w} onClick={() => patch({ warnSec: w })}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${config.warnSec === w ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                    {w === 0 ? t('tm_off') : `${w} ${t('tm_sec')}`}
                  </button>
                ))}
              </div>
            </Row>
            {/* Probar sonido: además de comprobar el volumen, desbloquea el audio
                del navegador (necesario en móvil) al ser un gesto del usuario. */}
            <Row label={t('tm_sound_test')}>
              <button onClick={() => { timerSounds.unlock(); timerSounds.bell(1); }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-white/5 text-zinc-300 hover:text-white border border-white/10 hover:border-white/25 cursor-pointer transition-colors">
                <i className="ri-volume-up-line"></i>{t('tm_sound_test_btn')}
              </button>
            </Row>
          </div>
        </Section>

        {/* ── Cambios de ritmo ── */}
        <Section icon="ri-rhythm-line" title={t('tm_burst_title')} sub={t('tm_burst_sub')}>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-white font-medium">{t('tm_burst_enable')}</span>
            <Toggle on={config.burst.enabled} onClick={() => patch({ burst: { ...config.burst, enabled: !config.burst.enabled } })} />
          </label>
          {config.burst.enabled && (
            <div className="space-y-4 mt-4 pt-4 border-t border-white/8">
              <Row label={t('tm_burst_count')}>
                <Stepper value={config.burst.count} min={1} max={20} onChange={(v) => patch({ burst: { ...config.burst, count: v } })} />
              </Row>
              <Row label={t('tm_burst_dur')}>
                <Stepper value={config.burst.durationSec} min={3} max={60} step={1} suffix={t('tm_sec')} onChange={(v) => patch({ burst: { ...config.burst, durationSec: v } })} />
              </Row>
              <Row label={t('tm_burst_mode')}>
                <div className="flex gap-1.5">
                  {(['random', 'fixed'] as const).map((m) => (
                    <button key={m} onClick={() => patch({ burst: { ...config.burst, mode: m } })}
                      className={`px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${config.burst.mode === m ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
                      {t(m === 'random' ? 'tm_burst_random' : 'tm_burst_fixed')}
                    </button>
                  ))}
                </div>
              </Row>
              <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                <i className="ri-information-line text-orange-400"></i>
                {t(config.burst.mode === 'random' ? 'tm_burst_random_hint' : 'tm_burst_fixed_hint')}
              </p>
            </div>
          )}
        </Section>

        {/* ── Combinaciones por asalto ── */}
        <Section icon="ri-boxing-line" title={t('tm_plan_title')} sub={t('tm_plan_sub')}>
          <div className="space-y-2">
            {Array.from({ length: config.rounds }).map((_, i) => {
              const rc = combosFor(i);
              const parts = roundComboParts(rc);
              const label = parts.text || parts.moves.map(moveLabel).join(', ');
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-3">
                  <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-red-600/12 border border-red-500/25 text-red-400 font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16 }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {rc ? <p className="text-sm text-white truncate">{label}</p>
                      : <p className="text-sm text-zinc-600">{t('tm_free_round')}</p>}
                  </div>
                  {rc ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setLibraryFor(i)} className="text-xs text-zinc-400 hover:text-white px-2 py-1 cursor-pointer">{t('tm_change')}</button>
                      <button onClick={() => setCombo(i, null)} className="text-zinc-600 hover:text-red-400 px-1 cursor-pointer"><i className="ri-close-line"></i></button>
                    </div>
                  ) : (
                    <button onClick={() => setLibraryFor(i)} className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 px-2 py-1 cursor-pointer">
                      <i className="ri-add-line"></i>{t('tm_assign')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => setLibraryFor('browse')} className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-white/12 hover:border-white/25 text-white text-sm font-semibold py-2.5 cursor-pointer transition-colors">
            <i className="ri-book-open-line"></i>{t('tm_lib_open')}
          </button>
        </Section>

        {/* ── IA de combinaciones ── */}
        <Section icon="ri-sparkling-2-line" title={t('tm_ai_title')} sub={t('tm_ai_sub')}>
          {aiChecking ? (
            <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : aiAvailable ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={t('tm_ai_ph')}
                onKeyDown={(e) => { if (e.key === 'Enter') runAi(); }}
                className="flex-1 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              <button onClick={runAi} disabled={aiLoading}
                className="rk-btn rk-btn-primary flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.85rem', padding: '0.7rem 1.3rem' }}>
                {aiLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('tm_ai_generating')}</> : <><i className="ri-magic-line"></i>{t('tm_ai_cta')}</>}
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-[#C9A84C]/8 border border-[#C9A84C]/25 px-4 py-3.5">
              <i className="ri-time-line text-[#C9A84C] mt-0.5 flex-shrink-0"></i>
              <div>
                <p className="text-sm font-bold text-[#C9A84C]">{t('tm_ai_soon_title')}</p>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{t('tm_ai_soon_desc')}</p>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Botón de empezar (fijo abajo) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-[#070707] via-[#070707]/95 to-transparent pt-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] px-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={onStart}
            className="w-full flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl py-4 cursor-pointer transition-colors shadow-lg shadow-red-600/30"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2 }}>
            <i className="ri-play-fill text-2xl"></i>{t('tm_start')}
          </button>
        </div>
      </div>

      {/* Biblioteca */}
      {libraryFor !== null && (
        <CombosLibrary
          rounds={config.rounds}
          defaultDiscipline={discipline}
          targetRound={libraryFor === 'browse' ? null : libraryFor}
          customCombos={customCombos}
          onSaveCustom={(c) => { onSaveCustom(c); showToast(t('tm_combo_saved')); }}
          onDeleteCustom={(id) => { onDeleteCustom(id); showToast(t('tm_combo_removed')); }}
          onAssign={(ri, combo) => setCombo(ri, combo)}
          onClose={() => setLibraryFor(null)}
        />
      )}
    </div>
  );
}

// ── UI reutilizable ──

function Section({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/8 p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <i className={`${icon} text-red-400`}></i>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      {sub && <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-sm text-zinc-300 font-medium">{label}</span>
      {children}
    </div>
  );
}

function MiniStat({ value, label, color = '#fff' }: { value: string; label: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 px-2 py-3 text-center">
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1, color }}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1 truncate">{label}</p>
    </div>
  );
}

function Stepper({ value, min, max, step = 1, wrap, suffix, onChange }: {
  value: number; min: number; max: number; step?: number; wrap?: boolean; suffix?: string; onChange: (v: number) => void;
}) {
  const dec = () => {
    let v = value - step;
    if (v < min) v = wrap ? max : min;
    onChange(v);
  };
  const inc = () => {
    let v = value + step;
    if (v > max) v = wrap ? min : max;
    onChange(v);
  };
  return (
    <div className="flex items-center gap-2">
      <button onClick={dec} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/12 text-white hover:bg-white/10 cursor-pointer active:scale-95 transition-transform">
        <i className="ri-subtract-line"></i>
      </button>
      <span className="min-w-[52px] text-center text-white tabular-nums" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22 }}>
        {value}{suffix ? <span className="text-zinc-500 text-xs ml-0.5">{suffix}</span> : ''}
      </span>
      <button onClick={inc} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/12 text-white hover:bg-white/10 cursor-pointer active:scale-95 transition-transform">
        <i className="ri-add-line"></i>
      </button>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer flex-shrink-0 ${on ? 'bg-red-600' : 'bg-white/12'}`}>
      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

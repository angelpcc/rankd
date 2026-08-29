import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmt, fmtLong } from '../lib/session';
import {
  RINCON_SPORTS, RINCON_LEVELS, FREQ_OPTIONS, REST_OPTIONS, ROUND_MIN_OPTIONS,
  activeCombos, rinconUid,
  type RinconCombo, type RinconConfig, type RinconPreset, type RinconSport, type RinconLevel, type TimerMode,
} from '../lib/rincon';
import RinconComboLibrary from './RinconComboLibrary';

interface Props {
  mode: TimerMode;
  onMode: (m: TimerMode) => void;
  config: RinconConfig;
  onConfig: (c: RinconConfig) => void;
  onStart: () => void;
  onBack: () => void;
  combos: RinconCombo[];
  onSaveCustom: (c: RinconCombo) => void;
  onUpdateCustom: (c: RinconCombo) => void;
  onDeleteCustom: (id: string) => void;
  presets: RinconPreset[];
  onSavePreset: (p: RinconPreset) => void;
  onDeletePreset: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function RinconSetup(props: Props) {
  const {
    mode, onMode, config, onConfig, onStart, onBack, combos,
    onSaveCustom, onUpdateCustom, onDeleteCustom, presets, onSavePreset, onDeletePreset, showToast,
  } = props;
  const { t } = useTranslation();
  const [libOpen, setLibOpen] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const patch = (p: Partial<RinconConfig>) => onConfig({ ...config, ...p });

  const pool = useMemo(() => activeCombos(combos, config), [combos, config]);
  const sportCombos = useMemo(() => combos.filter((c) => c.sport === config.sport), [combos, config.sport]);

  const roundMin = Math.round(config.roundSec / 60);

  const selectAll = () => patch({ comboIds: sportCombos.map((c) => c.id) });
  const selectBasics = () => patch({
    comboIds: combos.filter((c) => c.sport === config.sport && !c.isCustom && c.level === 'principiante').map((c) => c.id),
  });
  const selectAuto = () => patch({ comboIds: [] });

  const toggleCombo = (id: string) => {
    const set = new Set(config.comboIds.length ? config.comboIds : pool.map((c) => c.id));
    if (set.has(id)) set.delete(id); else set.add(id);
    patch({ comboIds: [...set] });
  };

  const doSavePreset = () => {
    const label = presetName.trim() || `${t(`tm_rc_sport_${config.sport}`)} ${config.rounds}×${fmt(config.roundSec)}`;
    onSavePreset({ ...config, id: rinconUid(), label });
    setSavingPreset(false); setPresetName('');
    showToast(t('tm_preset_saved'));
  };
  const applyPreset = (p: RinconPreset) => {
    const { id: _id, label: _label, ...cfg } = p;
    void _id; void _label;
    onConfig(cfg);
  };

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ minHeight: 40 }}
      className={`px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${on ? 'bg-red-600 text-white' : 'bg-white/[0.05] text-zinc-400 hover:text-white'}`}>
      {label}
    </button>
  );

  const canStart = pool.length > 0;

  return (
    <div className="min-h-screen bg-[#070707] text-white rk-safe-top">
      {/* Barra superior con el selector de modo */}
      <div className="sticky top-0 z-30 bg-[#070707]/92 backdrop-blur border-b border-white/8 rk-safe-top">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer flex-shrink-0">
            <i className="ri-arrow-left-line text-lg"></i><span className="hidden sm:inline">{t('tm_back')}</span>
          </button>
          <div className="flex items-center rounded-full bg-white/[0.05] border border-white/10 p-0.5 text-xs font-bold">
            <button onClick={() => onMode('classic')}
              className={`px-3 py-1.5 rounded-full cursor-pointer transition-colors ${mode === 'classic' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>
              {t('tm_rc_mode_classic')}
            </button>
            <button onClick={() => onMode('rincon')}
              className={`px-3 py-1.5 rounded-full cursor-pointer transition-colors ${mode === 'rincon' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
              {t('tm_rc_mode_rincon')}
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 flex-shrink-0">
            <i className="ri-time-line"></i>{fmtLong(config.rounds * config.roundSec + (config.rounds - 1) * config.restSec)}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-32 space-y-7">
        <div>
          <p className="rk-eyebrow">{t('tm_rc_kicker')}</p>
          <h1 className="rk-h1" style={{ margin: '4px 0 0', color: '#fff' }}>
            {t('tm_rc_title')} <span className="rk-red-glow">{t('tm_rc_title_accent')}</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-md">{t('tm_rc_sub')}</p>
        </div>

        {/* Deporte + nivel */}
        <Section icon="ri-boxing-line" title={t('tm_rc_style_title')} sub={t('tm_rc_style_sub')}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">{t('tm_rc_sport')}</p>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {RINCON_SPORTS.map((s: RinconSport) => chip(t(`tm_rc_sport_${s}`), config.sport === s, () => patch({ sport: s, comboIds: [] })))}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">{t('tm_rc_level')}</p>
          <div className="flex gap-1.5 flex-wrap">
            {RINCON_LEVELS.map((l: RinconLevel) => chip(t(`tm_rc_level_${l}`), config.level === l, () => patch({ level: l })))}
          </div>
        </Section>

        {/* Formato de asaltos */}
        <Section icon="ri-timer-flash-line" title={t('tm_rc_format_title')}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">{t('tm_round_dur')}</p>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {ROUND_MIN_OPTIONS.map((m) => chip(`${m} ${t('tm_min')}`, roundMin === m, () => patch({ roundSec: m * 60 })))}
          </div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-sm text-zinc-300 font-medium">{t('tm_rounds')}</span>
            <Stepper value={config.rounds} min={1} max={20} onChange={(v) => patch({ rounds: v })} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">{t('tm_rest_dur')}</p>
          <div className="flex gap-1.5 flex-wrap">
            {REST_OPTIONS.map((s) => chip(`${s}s`, config.restSec === s, () => patch({ restSec: s })))}
          </div>
        </Section>

        {/* Frecuencia de aviso */}
        <Section icon="ri-volume-up-line" title={t('tm_rc_freq_title')} sub={t('tm_rc_freq_sub')}>
          <div className="flex gap-1.5 flex-wrap">
            {FREQ_OPTIONS.map((s) => chip(t('tm_rc_freq_every', { n: s }), config.freqSec === s, () => patch({ freqSec: s })))}
          </div>
        </Section>

        {/* Combos activos */}
        <Section icon="ri-book-open-line" title={t('tm_rc_combos_title')} sub={t('tm_rc_combos_sub')}>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <button onClick={selectAuto}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${config.comboIds.length === 0 ? 'bg-red-600 text-white' : 'bg-white/[0.05] text-zinc-400 hover:text-white'}`}>
              {t('tm_rc_combos_auto')}
            </button>
            <button onClick={selectAll} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
              {t('tm_rc_select_all')}
            </button>
            <button onClick={selectBasics} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
              {t('tm_rc_only_basic')}
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            {config.comboIds.length === 0
              ? t('tm_rc_combos_auto_hint', { n: pool.length })
              : t('tm_rc_combos_count', { n: pool.length })}
          </p>
          <button onClick={() => setLibOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-white/12 hover:border-white/25 text-white text-sm font-semibold py-2.5 cursor-pointer transition-colors">
            <i className="ri-list-check-2"></i>{t('tm_rc_open_lib')}
          </button>
        </Section>

        {/* Preajustes */}
        <Section icon="ri-bookmark-line" title={t('tm_presets')}>
          {presets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {presets.map((p) => (
                <div key={p.id} className="relative rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <button onClick={() => applyPreset(p)} className="text-left w-full cursor-pointer">
                    <p className="text-sm font-bold text-white pr-5 truncate">{p.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{p.rounds}×{fmt(p.roundSec)} · {p.restSec}s</p>
                  </button>
                  <button onClick={() => { onDeletePreset(p.id); showToast(t('tm_preset_removed')); }}
                    className="absolute top-2 right-2 text-zinc-600 hover:text-red-400 cursor-pointer">
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
          {savingPreset ? (
            <div className="flex gap-2">
              <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder={t('tm_preset_name_ph')} autoFocus
                style={{ fontSize: 16, minHeight: 44 }}
                className="flex-1 bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" />
              <button onClick={doSavePreset} className="rk-btn rk-btn-primary" style={{ fontSize: '0.8rem', padding: '0 1.1rem' }}>{t('tm_save')}</button>
              <button onClick={() => setSavingPreset(false)} className="text-sm text-zinc-500 hover:text-white px-2 cursor-pointer">{t('tm_cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setSavingPreset(true)} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white cursor-pointer">
              <i className="ri-bookmark-line"></i>{t('tm_rc_save_preset')}
            </button>
          )}
        </Section>
      </div>

      {/* Empezar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-[#070707] via-[#070707]/95 to-transparent pt-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] px-4">
        <div className="max-w-3xl mx-auto">
          {!canStart && <p className="text-center text-xs text-orange-300/80 mb-2">{t('tm_rc_no_combos_warn')}</p>}
          <button onClick={onStart} disabled={!canStart}
            className="w-full flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl py-4 cursor-pointer transition-colors shadow-lg shadow-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2 }}>
            <i className="ri-play-fill text-2xl"></i>{t('tm_rc_start')}
          </button>
        </div>
      </div>

      <RinconComboLibrary
        open={libOpen}
        onClose={() => setLibOpen(false)}
        sport={config.sport}
        level={config.level}
        combos={combos}
        activeIds={config.comboIds.length ? config.comboIds : pool.map((c) => c.id)}
        onToggleActive={toggleCombo}
        onSaveCustom={onSaveCustom}
        onUpdateCustom={onUpdateCustom}
        onDeleteCustom={onDeleteCustom}
        showToast={showToast}
      />
    </div>
  );
}

function Section({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/8 p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <i className={`${icon} text-red-400`}></i>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      {sub ? <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{sub}</p> : <div className="mb-4" />}
      {children}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/12 text-white hover:bg-white/10 cursor-pointer active:scale-95 transition-transform">
        <i className="ri-subtract-line"></i>
      </button>
      <span className="min-w-[44px] text-center text-white tabular-nums" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22 }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/12 text-white hover:bg-white/10 cursor-pointer active:scale-95 transition-transform">
        <i className="ri-add-line"></i>
      </button>
    </div>
  );
}

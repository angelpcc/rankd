import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/base/BottomSheet';
import {
  RINCON_SPORTS, RINCON_LEVELS, RINCON_CATEGORIES, PAD_NUMBERS, padExtras,
  comboSpeech, notationTokens, tokenKey, rinconUid,
  type RinconCombo, type RinconSport, type RinconLevel, type RinconCategory,
} from '../lib/rincon';

interface Props {
  open: boolean;
  onClose: () => void;
  sport: RinconSport;
  level: RinconLevel;
  combos: RinconCombo[];
  activeIds: string[];
  onToggleActive: (id: string) => void;
  onSaveCustom: (c: RinconCombo) => void;
  onUpdateCustom: (c: RinconCombo) => void;
  onDeleteCustom: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type Filter<T> = T | 'all';

export default function RinconComboLibrary({
  open, onClose, sport, level, combos, activeIds,
  onToggleActive, onSaveCustom, onUpdateCustom, onDeleteCustom, showToast,
}: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'list' | 'create'>('list');

  // filtros de la lista
  const [q, setQ] = useState('');
  const [fSport, setFSport] = useState<Filter<RinconSport>>(sport);
  const [fLevel, setFLevel] = useState<Filter<RinconLevel>>('all');
  const [fCat, setFCat] = useState<Filter<RinconCategory>>('all');

  // estado del creador
  const [editId, setEditId] = useState<string | null>(null);
  const [cName, setCName] = useState('');
  const [cSport, setCSport] = useState<RinconSport>(sport);
  const [cLevel, setCLevel] = useState<RinconLevel>(level);
  const [cCat, setCCat] = useState<RinconCategory>('ataque');
  const [cTokens, setCTokens] = useState<string[]>([]);

  const active = useMemo(() => new Set(activeIds), [activeIds]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return combos.filter((c) => {
      if (fSport !== 'all' && c.sport !== fSport) return false;
      if (fLevel !== 'all' && c.level !== fLevel) return false;
      if (fCat !== 'all' && c.category !== fCat) return false;
      if (needle) {
        const hay = `${c.name} ${c.notation} ${comboSpeech(c, t)}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [combos, q, fSport, fLevel, fCat, t]);

  const mine = filtered.filter((c) => c.isCustom);
  const factory = filtered.filter((c) => !c.isCustom);

  const resetCreate = () => {
    setEditId(null); setCName(''); setCSport(sport); setCLevel(level); setCCat('ataque'); setCTokens([]);
  };
  const startCreate = () => { resetCreate(); setView('create'); };
  const startEdit = (c: RinconCombo) => {
    setEditId(c.id); setCName(c.name); setCSport(c.sport); setCLevel(c.level);
    setCCat(c.category); setCTokens(notationTokens(c.notation)); setView('create');
  };

  const saveCreate = () => {
    if (cTokens.length === 0) { showToast(t('tm_rc_need_moves'), 'error'); return; }
    const notation = cTokens.join('-');
    const name = cName.trim() || notation;
    const combo: RinconCombo = {
      id: editId ?? rinconUid(),
      name, notation, sport: cSport, level: cLevel, category: cCat,
      isCustom: true, createdAt: Date.now(),
    };
    if (editId) { onUpdateCustom(combo); showToast(t('tm_rc_combo_updated')); }
    else { onSaveCustom(combo); showToast(t('tm_combo_saved')); }
    resetCreate();
    setView('list');
  };

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${on ? 'bg-red-600 text-white' : 'bg-white/[0.05] text-zinc-400 hover:text-white'}`}>
      {label}
    </button>
  );

  const ComboRow = ({ c }: { c: RinconCombo }) => {
    const on = active.has(c.id);
    return (
      <div className={`rounded-xl border px-3.5 py-3 flex items-center gap-3 transition-colors ${on ? 'bg-red-600/[0.10] border-red-500/40' : 'bg-white/[0.03] border-white/10'}`}>
        <div className="min-w-0 flex-1">
          <p className="text-white truncate" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1 }}>
            {c.notation}
          </p>
          <p className="text-xs text-zinc-400 truncate">{comboSpeech(c, t)}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t(`tm_rc_level_${c.level}`)}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t(`tm_rc_cat_${c.category}`)}</span>
          </div>
        </div>
        {c.isCustom && (
          <div className="flex items-center flex-shrink-0">
            <button onClick={() => startEdit(c)} aria-label={t('tm_rc_edit')}
              className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer">
              <i className="ri-pencil-line"></i>
            </button>
            <button onClick={() => onDeleteCustom(c.id)} aria-label={t('tm_delete')}
              className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-red-400 cursor-pointer">
              <i className="ri-delete-bin-line"></i>
            </button>
          </div>
        )}
        <button onClick={() => onToggleActive(c.id)} aria-pressed={on} aria-label={on ? t('tm_rc_deactivate') : t('tm_rc_activate')}
          className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border cursor-pointer transition-colors ${on ? 'bg-red-600 border-red-600 text-white' : 'border-white/15 text-zinc-500 hover:text-white'}`}>
          <i className={on ? 'ri-check-line' : 'ri-add-line'}></i>
        </button>
      </div>
    );
  };

  const padTokens = [...PAD_NUMBERS, ...padExtras(cSport)];

  return (
    <BottomSheet
      open={open}
      onClose={() => { setView('list'); onClose(); }}
      title={view === 'create' ? (editId ? t('tm_rc_edit_combo') : t('tm_create_combo')) : t('tm_rc_lib_title')}
      footer={
        view === 'create' ? (
          <button onClick={saveCreate} disabled={cTokens.length === 0} style={{ minHeight: 48 }}
            className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            <i className="ri-save-line"></i>{editId ? t('tm_rc_save_changes') : t('tm_save_combo')}
          </button>
        ) : (
          <button onClick={() => { setView('list'); onClose(); }} style={{ minHeight: 48 }}
            className="rk-btn rk-btn-ghost w-full flex items-center justify-center gap-2">
            {t('tm_rc_done')}
          </button>
        )
      }
    >
      {view === 'list' ? (
        <div className="space-y-4">
          <button onClick={startCreate}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600/[0.10] border border-red-500/30 hover:border-red-500/55 text-red-300 text-sm font-bold py-2.5 cursor-pointer transition-colors">
            <i className="ri-add-line"></i>{t('tm_create_combo')}
          </button>

          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tm_rc_search_ph')}
            style={{ fontSize: 16, minHeight: 44 }}
            className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />

          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x">
              {chip(t('tm_filter_all'), fSport === 'all', () => setFSport('all'))}
              {RINCON_SPORTS.map((s) => chip(t(`tm_rc_sport_${s}`), fSport === s, () => setFSport(s)))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x">
              {chip(t('tm_filter_all'), fLevel === 'all', () => setFLevel('all'))}
              {RINCON_LEVELS.map((l) => chip(t(`tm_rc_level_${l}`), fLevel === l, () => setFLevel(l)))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 rk-noscroll-x">
              {chip(t('tm_filter_all'), fCat === 'all', () => setFCat('all'))}
              {RINCON_CATEGORIES.map((c) => chip(t(`tm_rc_cat_${c}`), fCat === c, () => setFCat(c)))}
            </div>
          </div>

          {filtered.length === 0 && <p className="text-sm text-zinc-500 py-6 text-center">{t('tm_no_results')}</p>}

          {mine.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{t('tm_my_combos')}</p>
              {mine.map((c) => <ComboRow key={c.id} c={c} />)}
            </div>
          )}
          {factory.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{t('tm_rc_factory')}</p>
              {factory.map((c) => <ComboRow key={c.id} c={c} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => { resetCreate(); setView('list'); }} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer">
            <i className="ri-arrow-left-line"></i>{t('tm_rc_back_lib')}
          </button>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('tm_rc_combo_name')}</label>
            <input value={cName} onChange={(e) => setCName(e.target.value)} maxLength={40}
              placeholder={t('tm_rc_combo_name_ph')} style={{ fontSize: 16, minHeight: 44 }}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
          </div>

          {/* notación en construcción */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-center">
            {cTokens.length === 0 ? (
              <p className="text-sm text-zinc-600 py-2">{t('tm_builder_empty')}</p>
            ) : (
              <>
                <p className="text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2 }}>
                  {cTokens.join('-')}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {cTokens.map((tok) => t(tokenKey(tok), { defaultValue: tok })).join(', ')}
                </p>
              </>
            )}
          </div>

          {/* pad de golpes */}
          <div className="grid grid-cols-3 gap-2">
            {padTokens.map((tok) => (
              <button key={tok} onClick={() => setCTokens((p) => [...p, tok])} style={{ minHeight: 52 }}
                className="rounded-xl border border-white/12 bg-white/[0.04] hover:border-white/30 text-white cursor-pointer transition-colors flex flex-col items-center justify-center gap-0.5">
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22 }}>{tok}</span>
                <span className="text-[10px] text-zinc-500">{t(tokenKey(tok), { defaultValue: '' })}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setCTokens((p) => p.slice(0, -1))} disabled={cTokens.length === 0}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-zinc-300 bg-white/[0.03] border border-white/10 hover:border-white/25 rounded-xl py-2.5 cursor-pointer transition-colors disabled:opacity-40">
            <i className="ri-arrow-go-back-line"></i>{t('tm_remove_last')}
          </button>

          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">{t('tm_rc_sport')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {RINCON_SPORTS.map((s) => chip(t(`tm_rc_sport_${s}`), cSport === s, () => { setCSport(s); if (s === 'boxeo') setCTokens((p) => p.filter((x) => PAD_NUMBERS.includes(x as typeof PAD_NUMBERS[number]))); }))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">{t('tm_filter_level')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {RINCON_LEVELS.map((l) => chip(t(`tm_rc_level_${l}`), cLevel === l, () => setCLevel(l)))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">{t('tm_rc_category')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {RINCON_CATEGORIES.map((c) => chip(t(`tm_rc_cat_${c}`), cCat === c, () => setCCat(c)))}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`.rk-noscroll-x::-webkit-scrollbar{display:none}.rk-noscroll-x{scrollbar-width:none}`}</style>
    </BottomSheet>
  );
}

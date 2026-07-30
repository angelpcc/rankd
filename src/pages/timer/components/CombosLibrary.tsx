import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COMBOS, MOVE_GROUPS, DISCIPLINES, LEVELS, FOCUSES,
  TECHNIQUE_VIDEOS, hasVideo, type Combo,
} from '../lib/combos';
import {
  uid, type CustomCombo, type Discipline, type Focus, type Level, type RoundCombo,
} from '../lib/session';

interface Props {
  rounds: number;
  defaultDiscipline?: Discipline;
  targetRound: number | null;   // si se abre para un asalto concreto (índice 0)
  customCombos: CustomCombo[];
  onSaveCustom: (c: CustomCombo) => void;
  onDeleteCustom: (id: string) => void;
  onAssign: (roundIndex: number, combo: RoundCombo) => void;
  onClose: () => void;
}

type Tab = 'library' | 'mine';

export default function CombosLibrary({
  rounds, defaultDiscipline, targetRound, customCombos,
  onSaveCustom, onDeleteCustom, onAssign, onClose,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('library');
  const [disc, setDisc] = useState<Discipline | 'all'>(defaultDiscipline || 'all');
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [focus, setFocus] = useState<Focus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [videoToken, setVideoToken] = useState<string | null>(null);
  // Selector de asalto in-line al asignar sin destino fijo.
  const [assigning, setAssigning] = useState<{ combo: RoundCombo } | null>(null);

  const moveLabel = (tok: string) => t(`tm_move_${tok}`, tok);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMBOS.filter((c) => {
      if (disc !== 'all' && c.discipline !== disc) return false;
      if (level !== 'all' && c.level !== level) return false;
      if (focus !== 'all' && !c.focus.includes(focus)) return false;
      if (q) {
        const text = c.moves.map((m) => moveLabel(m).toLowerCase()).join(' ');
        if (!text.includes(q)) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disc, level, focus, query, t]);

  const doAssign = (combo: RoundCombo) => {
    if (targetRound != null) { onAssign(targetRound, combo); onClose(); return; }
    setAssigning({ combo });
  };

  const confirmRound = (roundIndex: number) => {
    if (!assigning) return;
    onAssign(roundIndex, assigning.combo);
    setAssigning(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col rk-safe-top" style={{ animation: 'rankd-fade-in 0.2s ease' }}>
      <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="min-w-0">
            <p className="rk-eyebrow">{t('tm_lib_title')}</p>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {targetRound != null ? t('tm_round_n', { n: targetRound + 1 }) : t('tm_lib_sub')}
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex gap-2 px-4 sm:px-6 pt-3 flex-shrink-0">
          {(['library', 'mine'] as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${tab === tb ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
              {tb === 'library' ? t('tm_lib_title') : t('tm_my_combos')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {tab === 'library' ? (
            <>
              {/* Filtros */}
              <div className="space-y-2.5 mb-4">
                <FilterRow label={t('tm_filter_discipline')}>
                  <Chip active={disc === 'all'} onClick={() => setDisc('all')}>{t('tm_filter_all')}</Chip>
                  {DISCIPLINES.map((d) => <Chip key={d} active={disc === d} onClick={() => setDisc(d)}>{t(`tm_disc_${d}`)}</Chip>)}
                </FilterRow>
                <FilterRow label={t('tm_filter_level')}>
                  <Chip active={level === 'all'} onClick={() => setLevel('all')}>{t('tm_filter_all')}</Chip>
                  {LEVELS.map((l) => <Chip key={l} active={level === l} onClick={() => setLevel(l)}>{t(`tm_level_${l}`)}</Chip>)}
                </FilterRow>
                <FilterRow label={t('tm_filter_focus')}>
                  <Chip active={focus === 'all'} onClick={() => setFocus('all')}>{t('tm_filter_all')}</Chip>
                  {FOCUSES.map((f) => <Chip key={f} active={focus === f} onClick={() => setFocus(f)}>{t(`tm_focus_${f}`)}</Chip>)}
                </FilterRow>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('tm_search_ph')}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              </div>

              <p className="text-[11px] text-zinc-500 mb-3">{t('tm_count_combos', { n: filtered.length })}</p>

              {filtered.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm">{t('tm_no_results')}</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {filtered.map((c) => (
                    <ComboCard key={c.id} combo={c} moveLabel={moveLabel} onPlay={setVideoToken}
                      onAssign={() => doAssign({ kind: 'library', comboId: c.id })} assignLabel={t('tm_assign')} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <MyCombos t={t} moveLabel={moveLabel} defaultDiscipline={defaultDiscipline}
              customCombos={customCombos} onSaveCustom={onSaveCustom} onDeleteCustom={onDeleteCustom}
              onPlay={setVideoToken}
              onAssign={(moves) => doAssign({ kind: 'custom', text: moves.map(moveLabel).join(', '), moves })} />
          )}
        </div>
      </div>

      {/* Selector de asalto al asignar sin destino */}
      {assigning && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setAssigning(null)}>
          <div className="w-full max-w-md bg-zinc-950 border border-white/12 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-white mb-3">{t('tm_pick_round')}</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: rounds }).map((_, i) => (
                <button key={i} onClick={() => confirmRound(i)}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/12 text-white font-bold hover:bg-red-600 hover:border-red-500 cursor-pointer transition-colors"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reproductor de técnica */}
      {videoToken && TECHNIQUE_VIDEOS[videoToken] && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" onClick={() => setVideoToken(null)}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-white">{moveLabel(videoToken)}</p>
              <button onClick={() => setVideoToken(null)} className="text-zinc-400 hover:text-white cursor-pointer"><i className="ri-close-line text-xl"></i></button>
            </div>
            <video src={TECHNIQUE_VIDEOS[videoToken]} autoPlay loop muted playsInline controls
              className="w-full rounded-2xl border border-white/12 bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ──

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 flex-shrink-0 w-16">{label}</span>
      <div className="flex gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${active ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
      {children}
    </button>
  );
}

function MoveSequence({ moves, moveLabel, onPlay }: { moves: string[]; moveLabel: (t: string) => string; onPlay: (t: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {moves.map((m, i) => {
        const video = hasVideo(m);
        return (
          <span key={i} className="flex items-center gap-1.5">
            {video ? (
              <button onClick={() => onPlay(m)} title=""
                className="inline-flex items-center gap-1 rounded-lg bg-red-600/12 border border-red-500/30 text-red-200 hover:bg-red-600/22 px-2 py-1 text-xs font-semibold cursor-pointer">
                <i className="ri-play-circle-fill"></i>{moveLabel(m)}
              </button>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-white/[0.05] border border-white/10 text-zinc-200 px-2 py-1 text-xs font-semibold">{moveLabel(m)}</span>
            )}
            {i < moves.length - 1 && <i className="ri-arrow-right-s-line text-zinc-600"></i>}
          </span>
        );
      })}
    </div>
  );
}

function ComboCard({ combo, moveLabel, onPlay, onAssign, assignLabel }: {
  combo: Combo; moveLabel: (t: string) => string; onPlay: (t: string) => void; onAssign: () => void; assignLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 flex flex-col gap-3">
      <MoveSequence moves={combo.moves} moveLabel={moveLabel} onPlay={onPlay} />
      <div className="flex items-center gap-1.5 flex-wrap mt-auto">
        <Tag>{t(`tm_disc_${combo.discipline}`)}</Tag>
        <Tag>{t(`tm_level_${combo.level}`)}</Tag>
        {combo.focus.map((f) => <Tag key={f} muted>{t(`tm_focus_${f}`)}</Tag>)}
      </div>
      <button onClick={onAssign}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.05] border border-white/12 hover:border-red-500/50 hover:bg-red-600/10 text-white text-sm font-semibold py-2 cursor-pointer transition-colors">
        <i className="ri-add-line"></i>{assignLabel}
      </button>
    </div>
  );
}

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${muted ? 'text-zinc-500 bg-white/[0.04] border border-white/8' : 'text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/25'}`}>
      {children}
    </span>
  );
}

function MyCombos({ t, moveLabel, defaultDiscipline, customCombos, onSaveCustom, onDeleteCustom, onAssign, onPlay }: {
  t: (k: string, o?: Record<string, unknown>) => string;
  moveLabel: (tok: string) => string;
  defaultDiscipline?: Discipline;
  customCombos: CustomCombo[];
  onSaveCustom: (c: CustomCombo) => void;
  onDeleteCustom: (id: string) => void;
  onAssign: (moves: string[]) => void;
  onPlay: (tok: string) => void;
}) {
  const [building, setBuilding] = useState(false);
  const [moves, setMoves] = useState<string[]>([]);
  const [disc, setDisc] = useState<Discipline>(defaultDiscipline || 'boxing');

  const save = () => {
    if (moves.length === 0) return;
    onSaveCustom({ id: uid(), moves, discipline: disc, focus: [], createdAt: Date.now() });
    setMoves([]); setBuilding(false);
  };

  return (
    <div className="space-y-4">
      {!building && (
        <button onClick={() => setBuilding(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold py-3 cursor-pointer transition-colors">
          <i className="ri-add-line text-lg"></i>{t('tm_create_combo')}
        </button>
      )}

      {building && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-4">
          <div>
            <p className="text-sm font-bold text-white">{t('tm_builder_title')}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{t('tm_builder_sub')}</p>
          </div>

          {/* Disciplina */}
          <div className="flex gap-1.5 flex-wrap">
            {DISCIPLINES.map((d) => (
              <Chip key={d} active={disc === d} onClick={() => setDisc(d)}>{t(`tm_disc_${d}`)}</Chip>
            ))}
          </div>

          {/* Secuencia en construcción */}
          <div className="min-h-[52px] rounded-xl bg-black/30 border border-white/10 p-3">
            {moves.length === 0
              ? <p className="text-xs text-zinc-600">{t('tm_builder_empty')}</p>
              : <MoveSequence moves={moves} moveLabel={moveLabel} onPlay={onPlay} />}
          </div>

          {/* Paleta de golpes */}
          <div className="space-y-3">
            {MOVE_GROUPS.map((g) => (
              <div key={g.key}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">{t(`tm_movecat_${g.key}`)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.tokens.map((tok) => (
                    <button key={tok} onClick={() => setMoves((m) => [...m, tok])}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300 text-xs font-medium hover:border-red-500/50 hover:text-white cursor-pointer transition-colors">
                      {moveLabel(tok)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setMoves((m) => m.slice(0, -1))} disabled={moves.length === 0}
              className="flex-1 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-sm font-semibold py-2.5 cursor-pointer disabled:opacity-40">
              <i className="ri-arrow-go-back-line"></i> {t('tm_remove_last')}
            </button>
            <button onClick={save} disabled={moves.length === 0}
              className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 cursor-pointer disabled:opacity-40">
              <i className="ri-save-line"></i> {t('tm_save_combo')}
            </button>
          </div>
          <button onClick={() => { setBuilding(false); setMoves([]); }} className="w-full text-xs text-zinc-500 hover:text-white cursor-pointer">{t('tm_cancel')}</button>
        </div>
      )}

      {customCombos.length === 0 && !building ? (
        <p className="text-sm text-zinc-500 text-center py-10">{t('tm_no_my_combos')}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {customCombos.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 flex flex-col gap-3">
              <MoveSequence moves={c.moves} moveLabel={moveLabel} onPlay={onPlay} />
              <div className="flex items-center gap-2 mt-auto">
                <button onClick={() => onAssign(c.moves)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.05] border border-white/12 hover:border-red-500/50 hover:bg-red-600/10 text-white text-sm font-semibold py-2 cursor-pointer transition-colors">
                  <i className="ri-add-line"></i>{t('tm_assign')}
                </button>
                <button onClick={() => onDeleteCustom(c.id)} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-zinc-500 hover:text-red-400 cursor-pointer">
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

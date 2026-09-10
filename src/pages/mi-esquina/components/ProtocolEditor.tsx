import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clock, emptySegment, formatVarValue, localId, protocolTotals, protocolVarsFor,
  type Protocol, type ProtocolSegment, type ProtocolVarDef, type ProtocolVarId,
} from '@/pages/mi-esquina/lib/protocols';

// Editor de un protocolo de actividad (punto 16).
//
// Un tramo = cuánto dura + qué valores tocan en él. Las variables NO están
// escritas aquí: se piden a `protocolVarsFor(kind)`, así que la misma pantalla
// sirve para una cinta (inclinación + velocidad), una bici (resistencia +
// cadencia) o una actividad que solo se pueda describir por esfuerzo.
//
// Todo se edita con −/+ además del teclado: ajustar catorce tramos en el móvil
// abriendo el teclado numérico catorce veces es la forma más rápida de que
// nadie vuelva a usar la pantalla.

interface Props {
  /** Protocolo de partida (nuevo o existente). */
  initial: Protocol;
  saving: boolean;
  onSave: (p: Protocol) => void;
  onCancel: () => void;
}

/** "5:00" o "5" (minutos) → segundos. */
function parseDuration(raw: string): number {
  const s = raw.trim();
  const m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
}

export default function ProtocolEditor({ initial, saving, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name);
  const [note, setNote] = useState(initial.note || '');
  const [segments, setSegments] = useState<ProtocolSegment[]>(
    initial.segments.length > 0 ? initial.segments : [emptySegment(initial.kind)],
  );
  const [openSeg, setOpenSeg] = useState<string | null>(segments[0]?.id ?? null);

  const vars = protocolVarsFor(initial.kind);
  const totals = protocolTotals({ ...initial, segments });

  const patch = (id: string, changes: Partial<ProtocolSegment>) =>
    setSegments((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));

  const setValue = (id: string, varId: ProtocolVarId, value: number) =>
    setSegments((list) => list.map((s) => (s.id === id ? { ...s, values: { ...s.values, [varId]: value } } : s)));

  const addSegment = () => {
    // El tramo nuevo copia el último: en una sesión de intervalos los tramos se
    // parecen entre sí y partir de cero obliga a reteclearlo todo.
    const last = segments[segments.length - 1];
    const fresh: ProtocolSegment = last
      ? { ...last, id: localId(), values: { ...last.values }, label: undefined, note: undefined }
      : emptySegment(initial.kind);
    setSegments((l) => [...l, fresh]);
    setOpenSeg(fresh.id);
  };

  const duplicate = (s: ProtocolSegment) => {
    const copy: ProtocolSegment = { ...s, id: localId(), values: { ...s.values } };
    setSegments((l) => {
      const i = l.findIndex((x) => x.id === s.id);
      return [...l.slice(0, i + 1), copy, ...l.slice(i + 1)];
    });
    setOpenSeg(copy.id);
  };

  const remove = (id: string) => setSegments((l) => (l.length > 1 ? l.filter((s) => s.id !== id) : l));

  const move = (id: string, dir: -1 | 1) => setSegments((l) => {
    const i = l.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= l.length) return l;
    const copy = [...l];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

  const save = () => {
    onSave({
      ...initial,
      name: name.trim() || t('mc_pt_untitled'),
      note: note.trim() || undefined,
      segments: segments.filter((s) => s.seconds > 0 || (s.meters || 0) > 0),
    });
  };

  const canSave = segments.some((s) => s.seconds > 0 || (s.meters || 0) > 0);
  const inputCls = 'w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative rk-card w-full sm:max-w-lg flex flex-col"
        style={{ padding: 0, transform: 'none', maxHeight: '92vh', borderRadius: '20px 20px 0 0' }}>

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="min-w-0">
            <p className="rk-label" style={{ fontSize: 10 }}>{t('mc_pt_editor_eyebrow')}</p>
            <h3 className="rk-h3 truncate" style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>
              {t('mc_pt_editor_title')}
            </h3>
          </div>
          <button onClick={onCancel} aria-label={t('mc_close')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer flex-shrink-0">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_pt_field_name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              placeholder={t('mc_pt_field_name_ph')} className={inputCls} style={{ fontSize: 16, minHeight: 44 }} />
          </div>

          {/* Tramos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-white">{t('mc_pt_segments')}</p>
              <span className="text-[11px] text-zinc-500">
                {t('mc_pt_totals', { n: totals.segments, time: clock(totals.seconds) })}
              </span>
            </div>

            <div className="space-y-2">
              {segments.map((s, i) => {
                const open = openSeg === s.id;
                const byDistance = !!s.meters && s.meters > 0;
                return (
                  <div key={s.id} className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
                    <button onClick={() => setOpenSeg(open ? null : s.id)}
                      className="w-full flex items-center gap-3 text-left cursor-pointer px-3"
                      style={{ minHeight: 52 }}>
                      <span className="flex items-center justify-center rounded-lg flex-shrink-0 text-[11px] font-bold"
                        style={{ width: 26, height: 26, background: 'rgba(225,6,0,0.14)', border: '1px solid rgba(225,6,0,0.3)', color: '#ff6b66' }}>
                        {i + 1}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-white truncate">
                          {s.label || (byDistance ? `${s.meters} m` : clock(s.seconds))}
                        </span>
                        <span className="block text-[11px] text-zinc-500 truncate">
                          {segmentSummary(s, vars) || (byDistance ? `${s.meters} m` : clock(s.seconds))}
                        </span>
                      </span>
                      <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {open && (
                      <div className="px-3 pb-3 space-y-3 border-t border-white/[0.06] pt-3">
                        {/* Cómo se mide el tramo */}
                        <div className="flex gap-1.5">
                          <Toggle on={!byDistance} onClick={() => patch(s.id, { meters: undefined, seconds: s.seconds || 300 })}>
                            {t('mc_pt_by_time')}
                          </Toggle>
                          <Toggle on={byDistance} onClick={() => patch(s.id, { meters: s.meters || 400, seconds: 0 })}>
                            {t('mc_pt_by_distance')}
                          </Toggle>
                        </div>

                        {byDistance ? (
                          <Stepper label={t('mc_pt_field_meters')} value={s.meters || 0} step={50} min={50} max={20000}
                            decimals={0} unit="m" onChange={(v) => patch(s.id, { meters: v })} />
                        ) : (
                          <DurationField value={s.seconds} onChange={(v) => patch(s.id, { seconds: v })} />
                        )}

                        {/* Variables del tipo de actividad */}
                        {vars.map((v) => (
                          <Stepper key={v.id} label={t(v.labelKey)} value={s.values[v.id] ?? 0}
                            step={v.step} min={v.min} max={v.max} decimals={v.decimals} unit={v.unit}
                            display={v.format === 'pace' ? formatVarValue(v, s.values[v.id] ?? 0) : undefined}
                            onChange={(val) => setValue(s.id, v.id, val)} />
                        ))}

                        {/* Nombre del tramo */}
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_pt_field_label')}</label>
                          <input value={s.label || ''} onChange={(e) => patch(s.id, { label: e.target.value })}
                            maxLength={40} placeholder={t('mc_pt_field_label_ph')}
                            className={inputCls} style={{ fontSize: 16, minHeight: 44 }} />
                        </div>

                        {/* Acciones del tramo */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <MiniBtn icon="ri-arrow-up-line" label={t('mc_pt_move_up')} onClick={() => move(s.id, -1)} disabled={i === 0} />
                          <MiniBtn icon="ri-arrow-down-line" label={t('mc_pt_move_down')} onClick={() => move(s.id, 1)} disabled={i === segments.length - 1} />
                          <MiniBtn icon="ri-file-copy-line" label={t('mc_pt_duplicate')} onClick={() => duplicate(s)} />
                          <button onClick={() => remove(s.id)} disabled={segments.length === 1}
                            className="ml-auto text-[11px] text-zinc-500 hover:text-red-400 cursor-pointer px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ minHeight: 40 }}>
                            <i className="ri-delete-bin-line" /> {t('mc_delete')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={addSegment}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-xs font-semibold text-zinc-300 hover:border-white/35 cursor-pointer transition-colors"
              style={{ minHeight: 46 }}>
              <i className="ri-add-line" />{t('mc_pt_add_segment')}
            </button>
          </div>

          {/* Nota del protocolo */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_pt_field_note')}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={400}
              placeholder={t('mc_pt_field_note_ph')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none" />
          </div>
        </div>

        {/* Pie */}
        <div className="flex gap-2 px-5 py-4 border-t border-white/[0.07] flex-shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={onCancel} className="rk-nav-btn text-xs" style={{ padding: '0.7rem 1.2rem', minHeight: 48 }}>
            {t('mc_cancel')}
          </button>
          <button onClick={save} disabled={saving || !canSave}
            className="rk-btn rk-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ minHeight: 48 }}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_saving')}</>
              : <><i className="ri-check-line" />{t('mc_pt_save')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Resumen de una línea con los valores del tramo. */
function segmentSummary(s: ProtocolSegment, vars: ProtocolVarDef[]): string {
  return vars
    .filter((v) => s.values[v.id] !== undefined)
    .map((v) => `${formatVarValue(v, s.values[v.id] as number)}${v.unit ? ` ${v.unit}` : ''}`)
    .join(' · ');
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ minHeight: 40 }}
      className={`flex-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
        on ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/12 text-zinc-300 hover:border-white/30'
      }`}>
      {children}
    </button>
  );
}

function MiniBtn({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="w-10 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 text-zinc-300 hover:border-white/30 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
      style={{ minHeight: 40 }}>
      <i className={icon} />
    </button>
  );
}

/** Duración del tramo, en m:ss, con −/+ de 15 segundos. */
function DurationField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(clock(value));
  const [editing, setEditing] = useState(false);

  const bump = (dir: 1 | -1) => {
    const next = Math.max(15, Math.min(7200, Math.round((value + dir * 15) / 15) * 15));
    onChange(next);
    setText(clock(next));
  };

  const commit = () => {
    const secs = parseDuration(text);
    const next = secs > 0 ? Math.min(7200, secs) : value;
    onChange(next);
    setText(clock(next));
    setEditing(false);
  };

  const btn = 'w-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/12 text-white hover:bg-white/[0.12] active:scale-95 transition-all cursor-pointer disabled:opacity-35';

  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_pt_field_duration')}</label>
      <div className="flex items-stretch gap-1.5">
        <button type="button" onClick={() => bump(-1)} className={btn} style={{ minHeight: 44 }}
          aria-label={`${t('mc_pt_field_duration')} −15s`} disabled={value <= 15}>
          <i className="ri-subtract-line" />
        </button>
        <input inputMode="numeric" value={editing ? text : clock(value)}
          onFocus={() => { setEditing(true); setText(clock(value)); }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          aria-label={t('mc_pt_field_duration')}
          className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 text-white text-center rounded-xl py-2.5 focus:outline-none focus:border-red-500"
          style={{ fontSize: 16, minHeight: 44 }} />
        <button type="button" onClick={() => bump(1)} className={btn} style={{ minHeight: 44 }}
          aria-label={`${t('mc_pt_field_duration')} +15s`} disabled={value >= 7200}>
          <i className="ri-add-line" />
        </button>
      </div>
    </div>
  );
}

/** Campo numérico con −/+, igual criterio que el resto de Mi Esquina. */
function Stepper({ label, value, step, min, max, decimals, unit, display, onChange }: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  decimals: number;
  unit: string;
  /** Texto alternativo al número (ritmos en m:ss). */
  display?: string;
  onChange: (v: number) => void;
}) {
  const bump = (dir: 1 | -1) => {
    const next = Math.round((value + dir * step) / step) * step;
    onChange(+Math.min(max, Math.max(min, next)).toFixed(decimals));
  };
  const btn = 'w-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/12 text-white hover:bg-white/[0.12] active:scale-95 transition-all cursor-pointer disabled:opacity-35';

  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <div className="flex items-stretch gap-1.5">
        <button type="button" onClick={() => bump(-1)} className={btn} style={{ minHeight: 44 }}
          aria-label={`${label} −${step}`} disabled={value <= min}>
          <i className="ri-subtract-line" />
        </button>
        <div className="flex-1 min-w-0 relative">
          {display !== undefined ? (
            <div className="w-full bg-white/[0.04] border border-white/10 text-white text-center rounded-xl py-2.5 flex items-center justify-center"
              style={{ fontSize: 16, minHeight: 44 }}>{display}</div>
          ) : (
            <input inputMode="decimal" type="number" min={min} max={max} step={step} value={value}
              onChange={(e) => {
                const n = parseFloat(e.target.value.replace(',', '.'));
                onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
              }}
              aria-label={label}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-center rounded-xl py-2.5 focus:outline-none focus:border-red-500"
              style={{ fontSize: 16, minHeight: 44, paddingLeft: unit ? 30 : 8, paddingRight: unit ? 30 : 8 }} />
          )}
          {unit && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">{unit}</span>}
        </div>
        <button type="button" onClick={() => bump(1)} className={btn} style={{ minHeight: 44 }}
          aria-label={`${label} +${step}`} disabled={value >= max}>
          <i className="ri-add-line" />
        </button>
      </div>
    </div>
  );
}

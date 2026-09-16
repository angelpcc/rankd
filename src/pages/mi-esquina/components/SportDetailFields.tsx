// ════════════════════════════════════════════════════════════════
// RANKD · Registrar Hyrox y CrossFit por lo que de verdad son
//
// ── EL PROBLEMA ──
//
// Registrar un Hyrox pedía "duración" y "rondas". Con "75 minutos, 8 rondas"
// no se puede comparar nada: no sabes dónde se te fue la carrera, ni cuánto
// moviste en el trineo, ni si el remo fue mejor que el mes pasado. Y un WOD de
// CrossFit no es una duración: es un FORMATO con su resultado propio, y el
// resultado que cuenta cambia según el formato.
//
// ── LA REGLA ──
//
// Se pide el dato que MIDE ese deporte, no un dato genérico que valga para
// todos. En un AMRAP se piden rondas y repeticiones (la duración la dices tú al
// empezar: preguntarla no mide nada). En un For Time se pide el tiempo (las
// repeticiones son fijas). Preguntar el dato equivocado es la forma más rápida
// de que un registro no sirva dentro de un mes.
//
// Lo que sabe de cada deporte vive en `lib/sportSpecs.ts`. Aquí solo se pinta.
// ════════════════════════════════════════════════════════════════

import { useTranslation } from 'react-i18next';
import {
  HYROX_DIVISIONS, HYROX_STATIONS, WODS_CONOCIDOS, WOD_FORMATS,
  hyroxKg, usaHyrox, usaWod, wodFormat,
  type ActivityDetail, type HyroxDetail, type HyroxDivision, type WodDetail,
} from '../lib/sportSpecs';

interface Props {
  kind: string;
  value: ActivityDetail | null;
  onChange: (d: ActivityDetail | null) => void;
}

/** "7:30" → 450. Vacío o ilegible → undefined, que es "no lo apunté". */
function mmssASeg(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d{1,3})[:'.](\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + Math.min(59, parseInt(m[2], 10));
  const solo = t.match(/^(\d{1,4})$/);
  // Un número suelto son MINUTOS: nadie apunta "450" queriendo decir 7:30.
  return solo ? parseInt(solo[1], 10) * 60 : undefined;
}

function segAMmss(n?: number): string {
  if (!n || n <= 0) return '';
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

const campo = 'w-full bg-white/[0.04] border border-white/10 text-white rounded-lg px-2.5 py-2 focus:outline-none focus:border-red-500';

export default function SportDetailFields({ kind, value, onChange }: Props) {
  const { t } = useTranslation();
  if (usaHyrox(kind)) return <Hyrox value={value as HyroxDetail | null} onChange={onChange} t={t} />;
  if (usaWod(kind)) return <Wod value={value as WodDetail | null} onChange={onChange} t={t} />;
  return null;
}

type TFn = (k: string, o?: Record<string, unknown>) => string;

// ── HYROX ────────────────────────────────────────────────────────

function Hyrox({ value, onChange, t }: { value: HyroxDetail | null; onChange: (d: ActivityDetail | null) => void; t: TFn }) {
  const d: HyroxDetail = value || { sport: 'hyrox', stations: [] };
  const div: HyroxDivision = d.division || 'open_m';

  const estacion = (id: string) => d.stations.find((s) => s.id === id) || { id };
  const set = (id: string, patch: { seconds?: number; kg?: number }) => {
    const resto = d.stations.filter((s) => s.id !== id);
    onChange({ ...d, division: div, stations: [...resto, { ...estacion(id), ...patch }] });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="rk-label mb-1.5">{t('mc_sp_hx_division')}</p>
        {/* La división manda los pesos estándar. Va primero porque cambia lo
            que se sugiere en cada trineo de abajo. */}
        <div className="grid grid-cols-2 gap-1.5">
          {HYROX_DIVISIONS.map((o) => (
            <button key={o.value} type="button"
              onClick={() => onChange({ ...d, division: o.value, stations: d.stations })}
              className={`rk-chip rounded-xl border text-xs font-bold px-3 cursor-pointer ${div === o.value ? 'border-white/30 bg-white/[0.07] text-white' : 'border-white/10 text-zinc-400 hover:border-white/25'}`}
              style={{ minHeight: 42 }}>
              {t(o.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 leading-relaxed">{t('mc_sp_hx_intro')}</p>

      <div className="rk-card overflow-hidden" style={{ padding: 0 }}>
        {HYROX_STATIONS.map((st, i) => {
          const log = estacion(st.id);
          const estandar = hyroxKg(st, div);
          return (
            <div key={st.id} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-white/[0.05]' : ''}`}>
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg text-[11px] font-bold text-white"
                  style={{ background: 'rgba(225,6,0,0.18)' }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white leading-tight">{t(st.labelKey)}</p>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {st.metric === 'reps' ? t('mc_sp_reps_n', { n: st.reps?.m ?? 0 }) : `${st.meters} m`}
                    {st.hintKey ? ` · ${t(st.hintKey)}` : ''}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 pl-[34px]">
                <label className="block">
                  <span className="block text-[10px] text-zinc-500 mb-1">{t('mc_sp_time')}</span>
                  <input inputMode="numeric" placeholder="4:30" defaultValue={segAMmss(log.seconds)}
                    onBlur={(e) => set(st.id, { seconds: mmssASeg(e.target.value) })}
                    className={campo} style={{ fontSize: 16 }} />
                </label>
                {estandar !== undefined && (
                  <label className="block">
                    <span className="block text-[10px] text-zinc-500 mb-1">{t('mc_sp_kg')}</span>
                    <input inputMode="decimal" placeholder={String(estandar)} defaultValue={log.kg ?? ''}
                      onBlur={(e) => set(st.id, { kg: e.target.value ? Number(e.target.value.replace(',', '.')) : undefined })}
                      className={campo} style={{ fontSize: 16 }} />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <label className="block">
        <span className="rk-label block mb-1.5">{t('mc_sp_hx_run')}</span>
        <input inputMode="numeric" placeholder="40:00" defaultValue={segAMmss(d.runSeconds)}
          onBlur={(e) => onChange({ ...d, division: div, runSeconds: mmssASeg(e.target.value) })}
          className={campo} style={{ fontSize: 16 }} />
        <span className="block text-[10px] text-zinc-500 mt-1">{t('mc_sp_hx_run_h')}</span>
      </label>
    </div>
  );
}

// ── CROSSFIT / FUNCIONAL / CALISTENIA ────────────────────────────

function Wod({ value, onChange, t }: { value: WodDetail | null; onChange: (d: ActivityDetail | null) => void; t: TFn }) {
  const d: WodDetail = value || { sport: 'wod', format: 'amrap', movements: [] };
  const fmt = wodFormat(d.format) || WOD_FORMATS[0];

  const setMov = (i: number, patch: Partial<{ name: string; reps: number; kg: number }>) => {
    const movements = d.movements.map((m, k) => (k === i ? { ...m, ...patch } : m));
    onChange({ ...d, movements });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="rk-label mb-1.5">{t('mc_sp_wod_format')}</p>
        {/* El formato primero porque decide QUÉ resultado se pide abajo. */}
        <div className="grid grid-cols-2 gap-1.5">
          {WOD_FORMATS.map((f) => (
            <button key={f.id} type="button" onClick={() => onChange({ ...d, format: f.id })}
              className={`rk-chip rounded-xl border px-3 py-2 text-left cursor-pointer ${d.format === f.id ? 'border-white/30 bg-white/[0.07]' : 'border-white/10 hover:border-white/25'}`}>
              <span className="block text-xs font-bold text-white">{t(f.labelKey)}</span>
              <span className="block text-[10px] text-zinc-500 leading-tight mt-0.5">{t(f.descKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Los clásicos, para no teclear "21-15-9 thrusters y dominadas" cada vez
          que haces Fran. Rellenan formato, tope y movimientos de una vez. */}
      <div>
        <p className="rk-label mb-1.5">{t('mc_sp_wod_known')}</p>
        <div className="flex flex-wrap gap-1.5">
          {WODS_CONOCIDOS.map((w) => (
            <button key={w.name} type="button"
              onClick={() => onChange({ ...d, name: w.name, format: w.format, capMin: w.capMin, movements: w.movements.map((m) => ({ ...m })) })}
              className={`rk-chip text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer border ${d.name === w.name ? 'border-white/30 bg-white/[0.07] text-white' : 'border-white/10 text-zinc-300 hover:border-white/25'}`}>
              {w.name}
            </button>
          ))}
        </div>
      </div>

      {fmt.timed && (
        <label className="block">
          <span className="rk-label block mb-1.5">{t('mc_sp_wod_cap')}</span>
          <input inputMode="numeric" placeholder="20" defaultValue={d.capMin ?? ''}
            onBlur={(e) => onChange({ ...d, capMin: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            className={campo} style={{ fontSize: 16 }} />
        </label>
      )}

      {/* ── Movimientos ── */}
      <div>
        <p className="rk-label mb-1.5">{t('mc_sp_wod_movements')}</p>
        <div className="space-y-1.5">
          {d.movements.map((m, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <input value={m.name} onChange={(e) => setMov(i, { name: e.target.value })}
                placeholder={t('mc_sp_wod_mov_ph')} className={`${campo} flex-1 min-w-0`} style={{ fontSize: 16 }} />
              <input inputMode="numeric" defaultValue={m.reps ?? ''} placeholder={t('mc_sp_reps')}
                onBlur={(e) => setMov(i, { reps: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                className={campo} style={{ fontSize: 16, width: 66 }} />
              <input inputMode="decimal" defaultValue={m.kg ?? ''} placeholder="kg"
                onBlur={(e) => setMov(i, { kg: e.target.value ? Number(e.target.value.replace(',', '.')) : undefined })}
                className={campo} style={{ fontSize: 16, width: 62 }} />
              <button type="button" onClick={() => onChange({ ...d, movements: d.movements.filter((_, k) => k !== i) })}
                aria-label={t('mc_sp_wod_mov_del')}
                className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onChange({ ...d, movements: [...d.movements, { name: '' }] })}
          className="rk-nav-btn rk-press text-xs mt-2 inline-flex items-center gap-1.5" style={{ padding: '0.5rem 1rem' }}>
          <i className="ri-add-line" />{t('mc_sp_wod_mov_add')}
        </button>
      </div>

      {/* ── El resultado, en la unidad que pida ESTE formato ── */}
      <div>
        <p className="rk-label mb-1.5">{t('mc_sp_wod_result')}</p>
        {fmt.result === 'rounds_reps' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[10px] text-zinc-500 mb-1">{t('mc_sp_rounds')}</span>
              <input inputMode="numeric" defaultValue={d.rounds ?? ''} placeholder="12"
                onBlur={(e) => onChange({ ...d, rounds: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                className={campo} style={{ fontSize: 16 }} />
            </label>
            <label className="block">
              <span className="block text-[10px] text-zinc-500 mb-1">{t('mc_sp_extra_reps')}</span>
              <input inputMode="numeric" defaultValue={d.extraReps ?? ''} placeholder="7"
                onBlur={(e) => onChange({ ...d, extraReps: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                className={campo} style={{ fontSize: 16 }} />
            </label>
          </div>
        )}
        {fmt.result === 'time' && (
          <input inputMode="numeric" defaultValue={segAMmss(d.seconds)} placeholder="8:45"
            onBlur={(e) => onChange({ ...d, seconds: mmssASeg(e.target.value) })}
            className={campo} style={{ fontSize: 16 }} />
        )}
        {fmt.result === 'reps' && (
          <input inputMode="numeric" defaultValue={d.reps ?? ''} placeholder="120"
            onBlur={(e) => onChange({ ...d, reps: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            className={campo} style={{ fontSize: 16 }} />
        )}
        {fmt.result === 'load' && (
          <input inputMode="decimal" defaultValue={d.kg ?? ''} placeholder="80"
            onBlur={(e) => onChange({ ...d, kg: e.target.value ? Number(e.target.value.replace(',', '.')) : undefined })}
            className={campo} style={{ fontSize: 16 }} />
        )}
      </div>
    </div>
  );
}

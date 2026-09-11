import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Protocol } from '../lib/protocols';
import type { Routine } from '../lib/routines';
import { type DayAssignment } from '../lib/planLanding';

// ════════════════════════════════════════════════════════════════
// "¿Y qué días haces esto?"
//
// Lo que acabas de meter no tiene fecha: una rutina dice "Día A, Día B", un
// protocolo dice "40 minutos de cinta". La Agenda solo entiende días del
// calendario, así que falta un dato y hay exactamente una forma honesta de
// conseguirlo: preguntarlo.
//
// Se pregunta AQUÍ, justo después de importar y con el contenido delante, que
// es cuando el usuario tiene la respuesta fresca. Repartirlo solo (lunes,
// miércoles, viernes por defecto) sería inventarse su semana.
//
// Se puede saltar: entonces lo importado queda guardado pero sin días, y se
// asigna luego desde la Agenda.
// ════════════════════════════════════════════════════════════════

/** 0=domingo … 6=sábado, en orden L-D, que es como se lee una semana. */
const DOWS = [
  { n: 1, key: 'mc_wd_mon' }, { n: 2, key: 'mc_wd_tue' }, { n: 3, key: 'mc_wd_wed' },
  { n: 4, key: 'mc_wd_thu' }, { n: 5, key: 'mc_wd_fri' }, { n: 6, key: 'mc_wd_sat' },
  { n: 0, key: 'mc_wd_sun' },
];

interface Props {
  routine?: Routine;
  protocol?: Protocol;
  saving?: boolean;
  onCancel: () => void;
  onConfirmRoutine?: (a: DayAssignment[]) => void;
  onConfirmProtocol?: (dows: number[]) => void;
}

export default function PlanLanding({ routine, protocol, saving, onCancel, onConfirmRoutine, onConfirmProtocol }: Props) {
  const { t } = useTranslation();
  // Rutina: un día de la semana por cada día de la rutina.
  const [asign, setAsign] = useState<Record<string, number | null>>({});
  // Protocolo: los días en que se repite, que pueden ser varios.
  const [dows, setDows] = useState<number[]>([]);

  const toggleDow = (n: number) =>
    setDows((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  const hayAlgo = routine
    ? Object.values(asign).some((v) => v !== null && v !== undefined)
    : dows.length > 0;

  const confirmar = () => {
    if (routine) {
      onConfirmRoutine?.(routine.days.map((d) => ({ dayId: d.id, dow: asign[d.id] ?? null })));
    } else {
      onConfirmProtocol?.(dows);
    }
  };

  /** Fila de botones de día. `activo` decide cuál se ve marcado. */
  const filaDias = (activo: (n: number) => boolean, onPick: (n: number) => void) => (
    <div className="grid grid-cols-7 gap-1">
      {DOWS.map((d) => (
        <button key={d.n} type="button" onClick={() => onPick(d.n)}
          className={`rounded-lg border text-[11px] font-bold cursor-pointer transition-colors ${activo(d.n) ? 'border-white/30 text-white' : 'border-white/10 text-zinc-500 hover:border-white/20'}`}
          style={{ minHeight: 38, background: activo(d.n) ? 'var(--accent)' : 'rgba(255,255,255,0.02)' }}>
          {t(d.key).slice(0, 1).toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="rk-card" style={{ padding: 18 }}>
      <p className="text-sm font-bold text-white">{t('mc_land_title')}</p>
      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t('mc_land_desc')}</p>

      {routine && (
        <div className="space-y-3 mt-4">
          {routine.days.map((d) => (
            <div key={d.id}>
              <p className="text-xs font-semibold text-white mb-1.5">
                {d.name || t('mc_land_day_unnamed')}
                <span className="text-zinc-500 font-normal ml-1.5">
                  {t('mc_land_ex_count', { count: d.exercises.length })}
                </span>
              </p>
              {filaDias(
                (n) => asign[d.id] === n,
                // Volver a tocar el día ya elegido lo quita: así se deja fuera
                // un día de la rutina sin tener que buscar otro control.
                (n) => setAsign((p) => ({ ...p, [d.id]: p[d.id] === n ? null : n })),
              )}
            </div>
          ))}
        </div>
      )}

      {protocol && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-white mb-1.5">{protocol.name}</p>
          {filaDias((n) => dows.includes(n), toggleDow)}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={confirmar} disabled={saving || !hayAlgo}
          className="rk-btn rk-btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ minHeight: 46, fontSize: '0.85rem' }}>
          {saving
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><i className="ri-calendar-check-line" /> {t('mc_land_confirm')}</>}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="rk-nav-btn rk-press text-xs px-4 disabled:opacity-50" style={{ minHeight: 46 }}>
          {t('mc_land_skip')}
        </button>
      </div>
    </div>
  );
}

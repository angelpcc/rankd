import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Model, { MuscleType, type Muscle, type IExerciseData, type IMuscleStats } from 'react-body-highlighter';

export type MapGroup = 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'back' | 'core' | 'legs';
export type TrainState = 'none' | 'week' | 'today';

interface Props {
  status: Record<MapGroup, TrainState>;
  /** El muñeco es solo un SELECTOR: tocar un músculo abre el formulario de esa
   * zona (ejercicio + peso + reps + series). No registra nada por sí mismo. */
  onSelect: (g: MapGroup) => void;
}

const GROUPS: MapGroup[] = ['chest', 'shoulders', 'biceps', 'triceps', 'back', 'core', 'legs'];

// Qué músculos de react-body-highlighter representan cada grupo de RANKD, por
// vista. Verificado leyendo los datos reales del paquete (dist/*.cjs.development.js):
// bíceps/pecho/abs/obliques solo existen en 'anterior'; espalda (trapecio/
// upper-back/lower-back) solo en 'posterior'; tríceps y hombros están en ambas.
const FRONT_MUSCLES: Record<MapGroup, Muscle[]> = {
  chest: [MuscleType.CHEST],
  shoulders: [MuscleType.FRONT_DELTOIDS],
  biceps: [MuscleType.BICEPS],
  triceps: [MuscleType.TRICEPS],
  back: [],
  core: [MuscleType.ABS, MuscleType.OBLIQUES],
  legs: [MuscleType.QUADRICEPS, MuscleType.ABDUCTORS, MuscleType.CALVES, MuscleType.KNEES],
};
const BACK_MUSCLES: Record<MapGroup, Muscle[]> = {
  chest: [],
  shoulders: [MuscleType.BACK_DELTOIDS],
  biceps: [],
  triceps: [MuscleType.TRICEPS],
  back: [MuscleType.TRAPEZIUS, MuscleType.UPPER_BACK, MuscleType.LOWER_BACK],
  core: [],
  legs: [MuscleType.HAMSTRING, MuscleType.GLUTEAL, MuscleType.ABDUCTOR, MuscleType.CALVES, MuscleType.KNEES, MuscleType.LEFT_SOLEUS, MuscleType.RIGHT_SOLEUS],
};

// Inverso: de músculo del paquete a grupo de RANKD, para el onClick. Antebrazo
// se pliega en bíceps (RANKD no distingue antebrazo); cuello/cabeza no tienen
// grupo y no hacen nada al tocarlos.
const MUSCLE_TO_GROUP: Partial<Record<Muscle, MapGroup>> = {
  [MuscleType.CHEST]: 'chest',
  [MuscleType.FRONT_DELTOIDS]: 'shoulders',
  [MuscleType.BACK_DELTOIDS]: 'shoulders',
  [MuscleType.BICEPS]: 'biceps',
  [MuscleType.FOREARM]: 'biceps',
  [MuscleType.TRICEPS]: 'triceps',
  [MuscleType.TRAPEZIUS]: 'back',
  [MuscleType.UPPER_BACK]: 'back',
  [MuscleType.LOWER_BACK]: 'back',
  [MuscleType.ABS]: 'core',
  [MuscleType.OBLIQUES]: 'core',
  [MuscleType.QUADRICEPS]: 'legs',
  [MuscleType.ABDUCTORS]: 'legs',
  [MuscleType.ABDUCTOR]: 'legs',
  [MuscleType.HAMSTRING]: 'legs',
  [MuscleType.GLUTEAL]: 'legs',
  [MuscleType.CALVES]: 'legs',
  [MuscleType.KNEES]: 'legs',
  [MuscleType.LEFT_SOLEUS]: 'legs',
  [MuscleType.RIGHT_SOLEUS]: 'legs',
};

const BODY_COLOR = '#3f3f3f';
// index 0 = frecuencia 1 (semana, atenuado) · index 1 = frecuencia 2 (hoy, marca)
const HIGHLIGHT_COLORS = ['rgba(225,6,0,0.45)', '#E10600'];

export default function MuscleMap({ status, onSelect }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<'front' | 'back'>('front');
  const muscleMap = view === 'front' ? FRONT_MUSCLES : BACK_MUSCLES;

  const data: IExerciseData[] = GROUPS
    .filter((g) => status[g] !== 'none' && muscleMap[g].length > 0)
    .map((g) => ({ name: g, muscles: muscleMap[g], frequency: status[g] === 'today' ? 2 : 1 }));

  const handleClick = (stats: IMuscleStats) => {
    const group = MUSCLE_TO_GROUP[stats.muscle];
    if (group) onSelect(group);
  };

  return (
    <div className="rk-card" style={{ padding: '18px 16px', transform: 'none' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-zinc-500">{t('mc_str_map_title')}</p>
        <div className="flex gap-1 bg-white/[0.04] rounded-full p-0.5">
          {(['front', 'back'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${view === v ? 'bg-red-600 text-white' : 'text-zinc-400'}`}>
              {t(v === 'front' ? 'mc_str_map_front' : 'mc_str_map_back')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div style={{ width: '11rem', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.55))' }}>
          <Model
            type={view === 'front' ? 'anterior' : 'posterior'}
            data={data}
            bodyColor={BODY_COLOR}
            highlightedColors={HIGHLIGHT_COLORS}
            onClick={handleClick}
            style={{ width: '100%' }}
          />
        </div>

        <div className="flex items-center gap-3 mt-2 mb-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: HIGHLIGHT_COLORS[1], boxShadow: '0 0 8px rgba(225,6,0,0.7)' }} />{t('mc_str_map_today')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: HIGHLIGHT_COLORS[0] }} />{t('mc_str_map_week')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: BODY_COLOR }} />{t('mc_str_map_none')}</span>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 w-full">
          {GROUPS.map((g) => {
            const st = status[g];
            return (
              <button key={g} onClick={() => onSelect(g)} style={{ minHeight: 34 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-white/10 text-zinc-300 hover:border-white/25 hover:bg-white/[0.03] transition-all duration-200">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{
                  background: st === 'today' ? HIGHLIGHT_COLORS[1] : st === 'week' ? HIGHLIGHT_COLORS[0] : BODY_COLOR,
                  boxShadow: st === 'today' ? '0 0 8px rgba(225,6,0,0.6)' : undefined,
                }} />
                {t(`mc_str_mg_${g}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

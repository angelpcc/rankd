import { useTranslation } from 'react-i18next';
import MovementFigure from '@/components/base/MovementFigure';
import { techniqueFor } from '../lib/exerciseTechnique';

// Panel de ficha de técnica (PROMPT_4·B3). Contenido estático informativo:
// músculos secundarios, puntos de técnica y errores típicos. Sin promesas.
// Se despliega en línea desde el selector de ejercicios sin sacar al usuario
// de su pantalla. Si el ejercicio no tiene ficha, el componente renderiza null.

interface Props { name: string }

export default function ExerciseTechniqueCard({ name }: Props) {
  const { t, i18n } = useTranslation();
  const lang: 'es' | 'en' = i18n.language === 'en' ? 'en' : 'es';
  const f = techniqueFor(name, lang);
  if (!f) return null;

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
      {/* Figura del patrón: de un vistazo se ve de qué familia es el gesto
          (empujar, traccionar, bisagra...). No es una demostración del
          ejercicio concreto, y el pie de foto lo dice. */}
      {f.pattern && (
        <div className="flex items-center gap-3 rounded-xl px-3 py-2"
          style={{ background: 'var(--s-2)', border: '1px solid var(--s-3)' }}>
          <MovementFigure pattern={f.pattern} size={68} label={t(`mc_pat_${f.pattern}`)} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--t-3)' }}>
              {t('mc_ex_pattern_title')}
            </p>
            <p className="text-sm font-bold text-white">{t(`mc_pat_${f.pattern}`)}</p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--t-3)' }}>{t('mc_ex_pattern_hint')}</p>
          </div>
        </div>
      )}
      {/* Chips: músculos secundarios + material.
          Ya no son texto escrito a mano en la ficha: vienen de la biblioteca
          (LibExercise.secondary / .equipment) y se traducen aquí. Así no pueden
          contradecir a los filtros, que leen esos mismos campos. */}
      <div className="flex flex-wrap gap-1.5">
        {f.secondary.map((m) => (
          <span key={m} className="text-[10px] font-semibold text-zinc-300 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full">
            {t(`mc_str_mg_${m}`)}
          </span>
        ))}
        {f.equipment && (
          <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/12 border border-[#C9A84C]/25 px-2 py-0.5 rounded-full flex items-center gap-1">
            <i className="ri-tools-line text-[10px]" />{t(`mc_eq_${f.equipment}`)}
          </span>
        )}
      </div>

      {/* Técnica. Se oculta si el ejercicio aún no tiene texto escrito: los
          chips de arriba siguen siendo útiles por sí solos. */}
      {f.technique.length > 0 && (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-green-400 mb-1.5 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line" />{t('mc_ex_tech_title')}
        </p>
        <ul className="space-y-1">
          {f.technique.map((p, i) => (
            <li key={i} className="text-xs text-zinc-300 leading-relaxed flex items-start gap-1.5">
              <span className="text-green-500 mt-0.5">·</span>{p}
            </li>
          ))}
        </ul>
      </div>
      )}

      {/* Errores */}
      {f.mistakes.length > 0 && (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-400 mb-1.5 flex items-center gap-1.5">
          <i className="ri-error-warning-line" />{t('mc_ex_tech_mistakes')}
        </p>
        <ul className="space-y-1">
          {f.mistakes.map((m, i) => (
            <li key={i} className="text-xs text-zinc-300 leading-relaxed flex items-start gap-1.5">
              <span className="text-red-500 mt-0.5">×</span>{m}
            </li>
          ))}
        </ul>
      </div>
      )}
    </div>
  );
}

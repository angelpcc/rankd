import { useTranslation } from 'react-i18next';
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
      {/* Chips: músculos secundarios + material */}
      <div className="flex flex-wrap gap-1.5">
        {f.secondary.map((m) => (
          <span key={m} className="text-[10px] font-semibold text-zinc-300 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full capitalize">
            {m}
          </span>
        ))}
        <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/12 border border-[#C9A84C]/25 px-2 py-0.5 rounded-full flex items-center gap-1">
          <i className="ri-tools-line text-[10px]" />{f.equipment}
        </span>
      </div>

      {/* Técnica */}
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

      {/* Errores */}
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
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { loadPhysical, completeness, type FighterPhysical } from '@/lib/physicalProfile';
import PhysicalProfileForm from './PhysicalProfileForm';

// Indicador de perfil físico incompleto (Bloque A.3). Discreto, no intrusivo:
// barra de progreso fina + "Completar". En el Resumen se oculta cuando está al
// 100% (hideWhenComplete); en Ajustes se muestra siempre para poder editar.

interface Props {
  profileId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** En el Resumen: no pintar nada si el perfil ya está completo. */
  hideWhenComplete?: boolean;
}

export default function PhysicalProfileCard({ profileId, showToast, hideWhenComplete }: Props) {
  const { t } = useTranslation();
  const [physical, setPhysical] = useState<FighterPhysical | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    const { data, unavailable: un } = await loadPhysical(profileId);
    setPhysical(data); setUnavailable(un); setReady(true);
  }, [profileId]);

  useEffect(() => { reload(); }, [reload]);

  // Sin migración 0031 o aún cargando: no pintamos nada (degrada en silencio).
  if (!ready || unavailable) return null;

  const c = completeness(physical);
  const done = c.pct >= 100;
  if (done && hideWhenComplete) return null;

  return (
    <>
      <div className="rk-card flex items-center gap-4" style={{ padding: '16px 18px', transform: 'none' }}>
        <div className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-2xl border ${done ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-400' : 'bg-[#C9A84C]/12 border-[#C9A84C]/30 text-[#C9A84C]'}`}>
          <i className={`text-xl ${done ? 'ri-shield-check-line' : 'ri-user-heart-line'}`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">
            {done ? t('mc_pp_card_done') : t('mc_pp_card_title', { pct: c.pct })}
          </p>
          {!done && (
            <>
              <p className="text-xs text-zinc-400 mt-0.5">{t('mc_pp_card_desc')}</p>
              <div className="mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#E10600] to-[#C9A84C] transition-all" style={{ width: `${c.pct}%` }} />
              </div>
            </>
          )}
        </div>
        <button onClick={() => setOpen(true)} style={{ minHeight: 40 }}
          className={`flex-shrink-0 text-xs font-bold px-3.5 rounded-xl border cursor-pointer transition-colors ${done ? 'border-white/15 text-zinc-300 hover:text-white' : 'bg-white/[0.04] border-white/15 text-white hover:border-white/30'}`}>
          {done ? t('mc_edit') : t('mc_pp_card_cta')}
        </button>
      </div>

      <PhysicalProfileForm open={open} onClose={() => setOpen(false)} profileId={profileId} showToast={showToast} onSaved={() => reload()} />
    </>
  );
}

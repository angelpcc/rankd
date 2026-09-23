import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import ProtocolPlayer from './ProtocolPlayer';
import { finishRun, protocolTotals, saveProtocol } from '../lib/protocols';
import { sesionDelTexto } from '../lib/sessionTable';
import { activityKindCfg } from '../lib/dayPlan';
import { tinte } from '../lib/sectionTheme';

// ════════════════════════════════════════════════════════════════
// Debajo de una sesión del Asesor: hacerla YA, o guardarla para otro día.
//
// Sin esto, pedirle un Hyrox acababa en una tabla bonita que había que copiar
// a mano en otra pantalla, tramo a tramo, para poder seguirla con reloj. Aquí
// la tabla se lee en el navegador (lib/sessionTable) y se abre en el mismo
// reproductor que los cardios guardados: cuenta atrás, pitido al cambiar de
// tramo, y al terminar entra en el historial de Actividad como cualquier otra.
//
// "Guardar" la deja en Actividad › Cardios guardados, sin fecha, para hacerla
// el día que toque.
// ════════════════════════════════════════════════════════════════

interface Props {
  texto: string;
  profileId: string;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export default function ChatSessionCard({ texto, profileId, showToast }: Props) {
  const { t } = useTranslation();
  const sesion = useMemo(
    () => sesionDelTexto(texto, { nombre: t('mc_cs_default_name'), descanso: t('mc_cs_rest') }),
    [texto, t],
  );
  const [abierta, setAbierta] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardada, setGuardada] = useState(false);

  if (!sesion) return null;
  const p = sesion.protocol;
  const cfg = activityKindCfg(p.kind);
  const minutos = Math.max(1, Math.round(protocolTotals(p).seconds / 60));

  const guardar = async () => {
    if (guardando || guardada) return;
    setGuardando(true);
    try {
      const { storedLocally } = await saveProtocol(profileId, p);
      setGuardada(true);
      showToast?.(storedLocally ? t('mc_cs_saved_local') : t('mc_cs_saved_toast'));
    } catch {
      showToast?.(t('error_save'), 'error');
    }
    setGuardando(false);
  };

  const terminar = async (done: { secondsDone: number; segmentsDone: number; completed: boolean; distanceMeters: number }) => {
    setRegistrando(true);
    const res = await finishRun(profileId, p, done).catch(() => ({ sessionFailed: true }));
    setRegistrando(false);
    setAbierta(false);
    if (res.sessionFailed) { showToast?.(t('error_save'), 'error'); return; }
    showToast?.(t('mc_sc_logged'));
  };

  return (
    <>
      <div className="mt-3 rounded-2xl p-3 sm:p-3.5 flex flex-wrap items-center gap-3"
        style={{ background: tinte(cfg.hex, 0.07), border: `1px solid ${tinte(cfg.hex, 0.3)}` }}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: tinte(cfg.hex, 0.16), color: cfg.hex }}>
          <i className={`${cfg.icon} text-lg`} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{p.name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-3)' }}>
            {t(cfg.labelKey)} · {t('mc_cs_segments', { count: p.segments.length })} · ≈ {minutos} min
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setAbierta(true)}
            className="rk-cta rk-press flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-sm"
            style={{ minHeight: 42, padding: '0 1rem' }}>
            <i className="ri-play-fill text-base" />{t('mc_cs_do')}
          </button>
          <button onClick={guardar} disabled={guardando || guardada}
            className="rk-nav-btn rk-press inline-flex items-center justify-center gap-1.5 text-sm disabled:opacity-70"
            style={{ minHeight: 42, padding: '0 0.9rem', color: guardada ? '#4ade80' : undefined }}>
            {guardando
              ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <i className={guardada ? 'ri-check-line' : 'ri-bookmark-line'} />}
            {guardada ? t('mc_cs_saved') : t('mc_cs_save')}
          </button>
        </div>
      </div>

      {/* Al body: dentro del chat, cualquier animación con transform del
          mensaje convertiría el "fixed" del reproductor en relativo a él. */}
      {abierta && createPortal(
        <ProtocolPlayer protocol={p} saving={registrando}
          onExit={() => setAbierta(false)} onFinish={terminar} />,
        document.body,
      )}
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@/lib/supabase';
import VoiceButton from '@/components/feature/VoiceButton';
import { ACTIVITY_KINDS } from '../lib/dayPlan';
import {
  detectPlanKind, PLAN_KIND_ICON, PLAN_KIND_LABEL,
  type PlanGuess, type PlanKind,
} from '../lib/planDetect';
import { emptyRoutine, parseRoutineText, saveRoutine, type Routine } from '../lib/routines';
import { emptyProtocol, parseProtocolText, saveProtocol, type Protocol } from '../lib/protocols';
import { importRoutine, checkRoutineTextImportAvailable } from '@/services/routineTextImport';
import { importProtocol, checkProtocolImportAvailable } from '@/services/protocolImport';

// ════════════════════════════════════════════════════════════════
// LA ÚNICA PUERTA PARA METER UN PLAN
//
// ── POR QUÉ ESTÁ AQUÍ Y NO EN FUERZA / ACTIVIDAD ──
//
// Importar estaba repartido: las rutinas se metían desde Fuerza, los
// protocolos de cardio desde Actividad. Eso obligaba a saber ANTES de qué era
// el documento y a entrar por la puerta correcta; y un documento con fuerza y
// cardio dentro no tenía puerta buena. Además multiplicaba rincones: cada
// sección con su pequeño importador repetido.
//
// Ahora es al revés: METER un plan se hace en un sitio (aquí), y USAR lo que ya
// tienes sigue estando donde entrenas — la biblioteca de rutinas en Fuerza y la
// de protocolos en Actividad. Meter y usar son dos tareas distintas y cada una
// va donde tiene sentido.
//
// ── QUÉ HACE ──
//
// Pegas, dictas o escribes. `lib/planDetect.ts` decide de qué es. Si lo tiene
// claro lo dice y lo importa; si duda, PREGUNTA en vez de adivinar — colar una
// tabla de cinta en el historial de fuerza es peor que un clic de más.
//
// Y funciona sin IA: los lectores del navegador (`parseRoutineText`,
// `parseProtocolText`) leen el mismo texto. Con clave configurada, la IA lo
// hace mejor; sin ella, esto sigue funcionando entero.
// ════════════════════════════════════════════════════════════════

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Avisa de que hay algo nuevo guardado, para que las listas se recarguen. */
  onImported?: () => void;
  /** Manda el texto al planificador de semana, que ya vive en el panel padre. */
  onWeekText?: (text: string) => void;
  /** Manda el texto a la planificación de comidas. */
  onMealsText?: (text: string) => void;
}

const KINDS: PlanKind[] = ['routine', 'protocol', 'week', 'meals'];

/** Lee un archivo a base64 SIN el prefijo `data:…;base64,` que espera la API. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Nombre para lo importado, sacado del propio documento.
 *
 * Casi siempre la primera línea ES el título ("Rutina Push Pull Pierna",
 * "Cardio quema grasa 40'"). Si no sirve —es un número, es kilométrica— se cae
 * a un nombre genérico, que se puede cambiar luego en el editor.
 */
function nombreDesdeTexto(text: string, porDefecto: string): string {
  const primera = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  const limpia = primera.replace(/^[#*\-•\s]+/, '').trim();
  if (limpia.length < 3 || limpia.length > 60 || /^\d+$/.test(limpia)) return porDefecto;
  return limpia;
}

export default function PlanImport({ profile, showToast, onImported, onWeekText, onMealsText }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  // Tipo elegido a mano. Mientras sea null manda lo que detecte el texto.
  const [forced, setForced] = useState<PlanKind | null>(null);
  const [activityKind, setActivityKind] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiRoutine, setAiRoutine] = useState(false);
  const [aiProtocol, setAiProtocol] = useState(false);
  // Foto del documento. Solo la entiende la IA: el lector del navegador lee
  // texto, no imágenes. Por eso el botón solo aparece si hay IA disponible.
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    checkRoutineTextImportAvailable().then((ok) => { if (alive) setAiRoutine(ok); });
    checkProtocolImportAvailable().then((ok) => { if (alive) setAiProtocol(ok); });
    return () => { alive = false; };
  }, []);

  // La detección se recalcula al escribir. Es puro texto, sin red: no hace
  // falta esperar a que el usuario pulse nada para decirle qué se ha entendido.
  const guess: PlanGuess | null = useMemo(
    () => (text.trim().length >= 12 ? detectPlanKind(text) : null),
    [text],
  );

  // El usuario ha pedido ver todos los tipos aunque la detección fuera clara.
  const [verTodos, setVerTodos] = useState(false);

  const kind: PlanKind | null = forced ?? (guess?.confident ? guess.kind : null);
  // Cuando el detector duda, se pregunta. La sugerencia se enseña igualmente,
  // marcada como sugerencia, para que elegir cueste un toque y no una lectura.
  const preguntando = (!!guess || !!file) && ((!forced && !guess?.confident) || verTodos);

  // Tipo de actividad para un protocolo: el detectado, el elegido a mano, o hay
  // que preguntarlo. Sin él no se puede leer la tabla (las columnas cambian
  // según sea cinta, bici o remo).
  const actKind = activityKind ?? guess?.activityKind ?? null;
  const faltaActividad = kind === 'protocol' && !actKind;

  const reset = () => {
    setText(''); setForced(null); setActivityKind(null); setVerTodos(false);
    setFile(null); if (fileRef.current) fileRef.current.value = '';
  };

  const importar = async () => {
    if (!kind || saving) return;

    // ── Semana y comidas: los resuelve el panel padre ──
    if (kind === 'week') { onWeekText?.(text); return; }
    if (kind === 'meals') { onMealsText?.(text); return; }

    setSaving(true);
    try {
      if (kind === 'routine') {
        // Con IA sale mejor (entiende tablas y abreviaturas); sin ella, el
        // lector del navegador saca lo que puede del mismo texto.
        let rutina: Routine | null = null;
        if (aiRoutine) {
          const imageBase64 = file ? await fileToBase64(file) : undefined;
          const res = await importRoutine({ text: text.trim() || undefined, imageBase64, mediaType: file?.type });
          if (res.routine) {
            rutina = { ...res.routine, source: 'import' } as Routine;
          } else if (res.error) {
            showToast(res.error, 'error');
          }
        }
        if (!rutina) {
          // El lector del navegador devuelve los DÍAS sueltos, no una rutina
          // entera: el envoltorio (id, nombre, origen) lo pone `emptyRoutine`.
          const parsed = parseRoutineText(text);
          if (parsed.days.length === 0) {
            showToast(t('mc_imp_no_routine'), 'error');
            setSaving(false);
            return;
          }
          rutina = { ...emptyRoutine(nombreDesdeTexto(text, t('mc_imp_default_routine'))), days: parsed.days, source: 'import' };
        }
        const guardada = await saveRoutine(profile.id, rutina);
        showToast(guardada.storedLocally ? t('mc_imp_saved_local') : t('mc_imp_saved_routine'));
        onImported?.();
        reset();
        setSaving(false);
        return;
      }

      if (kind === 'protocol') {
        if (!actKind) { setSaving(false); return; }
        let prot: Protocol | null = null;
        if (aiProtocol) {
          const imageBase64 = file ? await fileToBase64(file) : undefined;
          const res = await importProtocol({ text: text.trim() || undefined, imageBase64, mediaType: file?.type, kind: actKind });
          if (res.protocol) {
            prot = { ...res.protocol, kind: actKind, source: 'import' } as Protocol;
          } else if (res.error) {
            showToast(res.error, 'error');
          }
        }
        if (!prot) {
          const parsed = parseProtocolText(text, actKind);
          if (parsed.segments.length === 0) {
            showToast(t('mc_imp_no_protocol'), 'error');
            setSaving(false);
            return;
          }
          // Los avisos del lector ("he supuesto que la primera columna eran
          // minutos") se enseñan: son justo lo que hay que revisar después.
          if (parsed.warnings.length > 0) showToast(parsed.warnings[0]);
          prot = { ...emptyProtocol(actKind, nombreDesdeTexto(text, t('mc_imp_default_protocol'))), segments: parsed.segments, source: 'import' };
        }
        const guardado = await saveProtocol(profile.id, prot);
        showToast(guardado.storedLocally ? t('mc_imp_saved_local') : t('mc_imp_saved_protocol'));
        onImported?.();
        reset();
      }
    } catch {
      showToast(t('error_save'), 'error');
    }
    setSaving(false);
  };

  return (
    <div className="rk-card" style={{ padding: 18 }}>
      <p className="text-sm font-bold text-white">{t('mc_imp_title')}</p>
      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t('mc_imp_desc')}</p>

      <div className="relative mt-3">
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setForced(null); setActivityKind(null); setVerTodos(false); }}
          placeholder={t('mc_imp_placeholder')}
          rows={7}
          className="w-full rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white p-3 resize-y focus:outline-none focus:border-white/25"
        />
        <div className="absolute right-2 bottom-3">
          <VoiceButton onResult={(s) => setText((p) => (p ? `${p}\n${s}` : s))} />
        </div>
      </div>

      {/* ── Foto del documento ──
          Solo con IA: leer una imagen no lo puede hacer el navegador. Se enseña
          únicamente cuando hay clave, para no ofrecer un botón que no haría
          nada. */}
      {(aiRoutine || aiProtocol) && (
        <>
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button onClick={() => fileRef.current?.click()}
            className="rk-nav-btn rk-press text-xs mt-2 inline-flex items-center gap-1.5"
            style={{ padding: '0.5rem 1rem' }}>
            <i className="ri-image-add-line" />
            {file ? file.name.slice(0, 28) : t('mc_imp_photo')}
          </button>
          {file && (
            <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 ml-2 cursor-pointer underline">
              {t('mc_imp_photo_clear')}
            </button>
          )}
        </>
      )}

      {/* ── Qué se ha entendido ── */}
      {(guess || file) && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
            {preguntando ? t('mc_imp_ask') : t('mc_imp_detected')}
          </p>

          {/* Con dudas se ofrecen los cuatro; con la decisión clara, solo se
              enseña cuál es, con la puerta abierta a cambiarla. */}
          <div className="grid grid-cols-2 gap-1.5">
            {(preguntando ? KINDS : [kind as PlanKind]).map((k) => (
              <button key={k} onClick={() => setForced(k)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer text-left ${kind === k ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 hover:border-white/20'}`}
                style={{ minHeight: 44 }}>
                <i className={PLAN_KIND_ICON[k]} style={{ color: 'var(--accent)' }} />
                <span className="text-white">{t(PLAN_KIND_LABEL[k])}</span>
              </button>
            ))}
          </div>

          {!preguntando && (
            <button onClick={() => setVerTodos(true)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 mt-2 cursor-pointer underline">
              {t('mc_imp_change')}
            </button>
          )}

          {guess && guess.signals.length > 0 && (
            <p className="text-[11px] text-zinc-600 mt-2">{guess.signals.join(' · ')}</p>
          )}
        </div>
      )}

      {/* ── Falta un dato: se pregunta, no se inventa ──
          Sin saber si es cinta, bici o remo no se puede leer la tabla: las
          columnas significan cosas distintas en cada una. */}
      {faltaActividad && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">
            {t('mc_imp_which_activity')}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {ACTIVITY_KINDS.filter((a) => a.value !== 'otro').map((a) => (
              <button key={a.value} onClick={() => setActivityKind(a.value)}
                className="flex items-center gap-1.5 px-2 py-2 rounded-xl border border-white/10 hover:border-white/25 text-[11px] font-semibold text-white cursor-pointer"
                style={{ minHeight: 40 }}>
                <i className={a.icon} style={{ color: a.hex }} />{t(a.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={importar}
        disabled={saving || !kind || faltaActividad}
        className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
        style={{ minHeight: 48 }}>
        {saving
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <><i className="ri-download-2-line" /> {t('mc_imp_go')}</>}
      </button>

      {/* Sin clave de IA sigue funcionando: conviene decirlo, porque si no
          parece que la pantalla está a medias. */}
      {!aiRoutine && !aiProtocol && (
        <p className="text-[11px] text-zinc-600 mt-2 text-center">{t('mc_imp_no_ai')}</p>
      )}
    </div>
  );
}

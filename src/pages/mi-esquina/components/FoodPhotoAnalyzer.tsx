import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkPhotoAnalysisAvailable, analyzeFoodPhoto, type NutritionAnalysis,
} from '@/services/nutritionAnalysis';

// Analizar comida con foto (PROMPT_1 · bloque 2).
//
// La IA está EN PAUSA: mientras no haya clave, la sonda GET devuelve
// available=false y se muestra el estado "disponible pronto" (los botones de
// cámara/subida quedan deshabilitados). Toda la tubería (subida, preview,
// validación, análisis, tarjeta de resultado) está cableada para funcionar en
// cuanto se active la clave, sin tocar el front. La tubería vive en
// services/nutritionAnalysis.ts y api/coach.js (modo foodPhoto).

interface Props {
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Guardar el análisis en el diario (opcional; si falta, solo avisa). */
  onSave?: (analysis: NutritionAnalysis) => Promise<void> | void;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPT = 'image/jpeg,image/png,image/webp';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

export default function FoodPhotoAnalyzer({ showToast, onSave }: Props) {
  const { t } = useTranslation();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<NutritionAnalysis | null>(null);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    checkPhotoAnalysisAvailable().then((ok) => { if (alive) setAvailable(ok); });
    return () => { alive = false; };
  }, []);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!ACCEPT.split(',').includes(f.type)) { showToast(t('mc_food_photo_err_type'), 'error'); return; }
    if (f.size > MAX_BYTES) { showToast(t('mc_food_photo_err_size'), 'error'); return; }
    setResult(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); };

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await analyzeFoodPhoto(base64, file.type);
      if (res.analysis) setResult(res.analysis);
      else showToast(res.error || t('mc_food_photo_err_type'), 'error');
    } catch {
      showToast(t('mc_food_photo_err_type'), 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      if (onSave) await onSave(result);
      showToast(t('mc_food_photo_saved'));
      reset();
    } finally {
      setSaving(false);
    }
  };

  const soon = available === false;

  return (
    <div className="rk-card relative overflow-hidden" style={{ padding: 20, transform: 'none', borderColor: 'rgba(225,6,0,0.25)' }}>
      <div className="rk-glow-red" style={{ width: 180, height: 180, top: -80, right: -50, borderRadius: '50%' }} />
      <div className="relative flex items-start gap-3">
        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-red-600/12 border border-red-500/25 text-red-400">
          <i className="ri-camera-lens-line text-2xl" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="rk-h3" style={{ fontSize: '1.1rem', color: '#fff' }}>{t('mc_food_photo_title')}</h3>
            {soon && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-2 py-0.5 rounded-full">
                {t('mc_food_photo_soon_badge')}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{t('mc_food_photo_desc')}</p>
        </div>
      </div>

      {/* Estado "disponible pronto" (IA en pausa) */}
      {soon && (
        <p className="mt-4 text-xs text-zinc-500 flex items-start gap-1.5 leading-relaxed">
          <i className="ri-time-line mt-0.5 flex-shrink-0" />{t('mc_food_photo_soon_note')}
        </p>
      )}

      {/* Entradas de foto (activas solo cuando la IA está disponible) */}
      {!result && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <input ref={cameraRef} type="file" accept={ACCEPT} capture="environment" className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] || null)} />
          <input ref={uploadRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] || null)} />
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={soon || analyzing}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-zinc-200 hover:border-white/25 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <i className="ri-camera-line" />{t('mc_food_photo_camera')}
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            disabled={soon || analyzing}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-zinc-200 hover:border-white/25 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <i className="ri-image-add-line" />{t('mc_food_photo_upload')}
          </button>
        </div>
      )}

      {/* Preview + analizar */}
      {preview && !result && (
        <div className="mt-4">
          <img src={preview} alt="" className="w-full max-h-56 object-cover rounded-xl border border-white/10" />
          <div className="flex gap-3 mt-3">
            <button onClick={reset} disabled={analyzing}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:border-zinc-500 transition-colors cursor-pointer disabled:opacity-60">
              {t('mc_food_photo_change')}
            </button>
            <button onClick={analyze} disabled={analyzing}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {analyzing
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('mc_food_photo_analyzing')}</>
                : <><i className="ri-sparkling-2-line" />{t('mc_food_photo_analyze')}</>}
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-3">
            {preview && <img src={preview} alt="" className="w-20 h-20 object-cover rounded-xl border border-white/10 flex-shrink-0" />}
            <div className="flex-1 min-w-0 grid grid-cols-4 gap-2">
              {[
                { l: 'kcal', v: Math.round(result.total.calorias), c: '#fff' },
                { l: t('mc_food_photo_protein'), v: `${Math.round(result.total.proteina)}g`, c: '#E10600' },
                { l: t('mc_food_photo_carbs'), v: `${Math.round(result.total.carbohidratos)}g`, c: '#C9A84C' },
                { l: t('mc_food_photo_fat'), v: `${Math.round(result.total.grasas)}g`, c: '#38bdf8' },
              ].map((m) => (
                <div key={m.l} className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-2 text-center">
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1, color: m.c }}>{m.v}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{m.l}</p>
                </div>
              ))}
            </div>
          </div>

          {result.alimentos.length > 0 && (
            <ul className="space-y-1">
              {result.alimentos.map((a, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-zinc-300 bg-white/[0.02] rounded-lg px-3 py-2">
                  <span className="truncate">{a.nombre} · {Math.round(a.gramos)}g</span>
                  <span className="text-zinc-500 flex-shrink-0 ml-2">{Math.round(a.calorias)} kcal</span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-amber-400/90 flex items-start gap-1.5 leading-relaxed">
            <i className="ri-alert-line mt-0.5 flex-shrink-0" />{result.disclaimer}
          </p>

          <div className="flex gap-2">
            <button onClick={reset}
              className="py-2.5 px-3 rounded-xl border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-500 transition-colors cursor-pointer">
              {t('mc_food_photo_retry')}
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><i className="ri-save-line" />{t('mc_food_photo_save')}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useContentGenerationAvailable } from '../lib/useAvailable';
import { generateVideoScript, generateVariation, type GeneratedVideoScript, type VideoScriptInput } from '@/services/contentGeneration';
import { createContent, type ContentRow } from '../lib/contentStore';
import { VIDEO_TEMPLATES } from '../lib/templates';
import ContentLibrary from '../components/ContentLibrary';
import ContentEditorModal from '../components/ContentEditorModal';

const ACCENT = '#E10600';
const PLATFORMS: { value: VideoScriptInput['platform']; label: string }[] = [
  { value: 'reels', label: 'Reels' }, { value: 'tiktok', label: 'TikTok' }, { value: 'shorts', label: 'Shorts' },
  { value: 'facebook', label: 'Facebook' }, { value: 'custom', label: 'Otro' },
];
const DURATIONS: VideoScriptInput['duration'][] = [15, 30, 60];

export default function VideoStudio() {
  const available = useContentGenerationAvailable();
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState<VideoScriptInput['platform']>('reels');
  const [duration, setDuration] = useState<VideoScriptInput['duration']>(30);
  const [includeText, setIncludeText] = useState(true);
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [includeCta, setIncludeCta] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<ContentRow<GeneratedVideoScript> | null>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    const res = await generateVideoScript({ prompt: prompt.trim(), platform, duration, includeText, includeSubtitles, includeMusic, includeCta });
    setGenerating(false);
    if (res.error || !res.data) { setError(res.error || 'No se pudo generar el guion.'); return; }
    const row = await createContent('video', platform, res.data.title || prompt.slice(0, 60), prompt, res.data);
    if (!row) { setError('Se generó el guion pero no se pudo guardar.'); return; }
    setPrompt('');
    setRefreshKey((k) => k + 1);
    setEditing(row);
  };

  return (
    <div className="space-y-6">
      <div className="rk-card space-y-4" style={{ padding: 20 }}>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">¿Qué quieres comunicar?</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={800}
            placeholder="Ej: un vídeo mostrando cómo registrar un entreno en Mi Esquina"
            style={{ fontSize: 16 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-y" />
          <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1">
            {VIDEO_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => setPrompt(t.prompt)} style={{ minHeight: 36 }}
                className="flex-shrink-0 text-[11px] font-semibold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 rounded-full px-3 cursor-pointer whitespace-nowrap">
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Plataforma</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as VideoScriptInput['platform'])}
              style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 cursor-pointer">
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Duración</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value) as VideoScriptInput['duration'])}
              style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 cursor-pointer">
              {DURATIONS.map((d) => <option key={d} value={d}>{d}s</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {([['Texto en pantalla', includeText, setIncludeText], ['Subtítulos', includeSubtitles, setIncludeSubtitles], ['Música', includeMusic, setIncludeMusic], ['CTA', includeCta, setIncludeCta]] as const).map(([label, val, setter]) => (
            <label key={label} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} className="w-4 h-4 accent-red-600 cursor-pointer" />
              {label}
            </label>
          ))}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button onClick={generate} disabled={generating || !prompt.trim() || available === false} style={{ minHeight: 44 }}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {generating
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generando...</>
            : <><i className="ri-movie-2-line"></i> 🎬 Generar vídeo</>}
        </button>
        {available === false && (
          <p className="text-[11px] text-[#C9A84C] flex items-center gap-1.5"><i className="ri-time-line"></i>IA disponible pronto: falta la clave de Anthropic en el servidor.</p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mb-3">Biblioteca de vídeos</p>
        <ContentLibrary<GeneratedVideoScript> type="video" refreshKey={refreshKey} onOpen={setEditing} accent={ACCENT}
          subtypeLabel={(s) => PLATFORMS.find((p) => p.value === s)?.label || s || ''} />
      </div>

      {editing && (
        <ContentEditorModal<GeneratedVideoScript>
          row={editing} accent={ACCENT} available={available === true}
          onClose={() => setEditing(null)}
          onSaved={(r) => { setEditing(r); setRefreshKey((k) => k + 1); }}
          onGenerateVariation={(content) => generateVariation<GeneratedVideoScript>('video', content)}
          renderFields={(content, setContent) => (
            <div className="space-y-3">
              {content.scenes.map((scene, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-red-600/15 border border-red-500/30 text-red-400 text-[11px] font-bold">{i + 1}</span>
                    <input value={scene.startTime} type="number" onChange={(e) => setContent({ ...content, scenes: content.scenes.map((s, j) => j === i ? { ...s, startTime: Number(e.target.value) } : s) })}
                      className="w-14 bg-white/[0.04] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5" />
                    <span className="text-zinc-600 text-xs">→</span>
                    <input value={scene.endTime} type="number" onChange={(e) => setContent({ ...content, scenes: content.scenes.map((s, j) => j === i ? { ...s, endTime: Number(e.target.value) } : s) })}
                      className="w-14 bg-white/[0.04] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5" />
                    <span className="text-[10px] text-zinc-600">seg</span>
                    <button onClick={() => setContent({ ...content, scenes: content.scenes.filter((_, j) => j !== i) })}
                      className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer"><i className="ri-delete-bin-line text-sm"></i></button>
                  </div>
                  <input value={scene.text} placeholder="Texto en pantalla" onChange={(e) => setContent({ ...content, scenes: content.scenes.map((s, j) => j === i ? { ...s, text: e.target.value } : s) })}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
                  <textarea value={scene.action} placeholder="Qué ocurre en pantalla" rows={2} onChange={(e) => setContent({ ...content, scenes: content.scenes.map((s, j) => j === i ? { ...s, action: e.target.value } : s) })}
                    className="w-full bg-white/[0.04] border border-white/10 text-zinc-300 text-xs rounded-lg px-3 py-2 resize-none" />
                </div>
              ))}
              <button onClick={() => setContent({ ...content, scenes: [...content.scenes, { startTime: 0, endTime: 5, action: '', ui: '', text: '', transition: 'corte', notes: '' }] })}
                className="w-full py-2.5 rounded-xl border border-white/10 text-xs font-bold text-zinc-400 hover:border-white/25 cursor-pointer">+ Añadir escena</button>
              <input value={content.caption} placeholder="Descripción" onChange={(e) => setContent({ ...content, caption: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
              <input value={content.hashtags.join(' ')} placeholder="#hashtags" onChange={(e) => setContent({ ...content, hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
            </div>
          )}
          renderPreview={(content) => (
            <div className="space-y-3">
              <div className="rk-card text-center" style={{ padding: '32px 20px' }}>
                <i className="ri-movie-2-line text-3xl text-zinc-600"></i>
                <p className="text-sm font-bold text-white mt-2">Vídeo generado (prototipo)</p>
                <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">Todavía no se renderizan clips reales. Descarga el guion y móntalo con <a className="text-red-400 underline" href="https://www.remotion.dev" target="_blank" rel="noopener noreferrer">Remotion</a> u otra herramienta de edición.</p>
                <button onClick={() => {
                  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'guion-video.json'; a.click(); URL.revokeObjectURL(url);
                }} className="mt-4 text-xs font-bold text-white bg-white/[0.06] border border-white/15 rounded-xl px-4 py-2.5 cursor-pointer hover:border-white/30">
                  <i className="ri-download-line"></i> Descargar guion
                </button>
              </div>
              <div className="space-y-1.5">
                {content.scenes.map((s, i) => (
                  <div key={i} className="text-xs text-zinc-300 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
                    <span className="text-zinc-600">{s.startTime}-{s.endTime}s</span> · {s.text || s.action}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500">🎵 {content.musicSuggestion} · {content.cta}</p>
            </div>
          )}
        />
      )}
    </div>
  );
}

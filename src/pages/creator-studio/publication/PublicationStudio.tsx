import { useState } from 'react';
import { useContentGenerationAvailable } from '../lib/useAvailable';
import { generatePublication, generateVariation, type GeneratedPublication, type PublicationInput } from '@/services/contentGeneration';
import { createContent, type ContentRow } from '../lib/contentStore';
import { PUBLICATION_TEMPLATES } from '../lib/templates';
import ContentLibrary from '../components/ContentLibrary';
import ContentEditorModal from '../components/ContentEditorModal';

const ACCENT = '#C9A84C';
const FORMATS: { value: PublicationInput['format']; label: string }[] = [
  { value: 'post', label: 'Post' }, { value: 'carousel', label: 'Carrusel' }, { value: 'story', label: 'Story' },
  { value: 'square', label: 'Cuadrado' }, { value: 'horizontal', label: 'Horizontal' }, { value: 'custom', label: 'Otro' },
];
const ALL_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'Twitter', 'TikTok'];
const TONES: { value: PublicationInput['tone']; label: string }[] = [
  { value: 'profesional', label: 'Profesional' }, { value: 'casual', label: 'Casual' },
  { value: 'motivador', label: 'Motivador' }, { value: 'tecnico', label: 'Técnico' }, { value: 'urgente', label: 'Urgente' },
];

function PublicationPreview({ content }: { content: GeneratedPublication }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: 'linear-gradient(155deg, #0B0B0B 0%, #1a0605 70%, #030303 100%)' }}>
      <div className="p-6 space-y-3" style={{ minHeight: 260 }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 3, color: '#C9A84C' }}>RANKD</span>
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1.05, color: '#fff' }}>{content.headline || 'TITULAR'}</h3>
        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{content.emoji ? `${content.emoji} ` : ''}{content.body}</p>
        {content.cta && <p className="text-xs font-bold text-[#E10600]">{content.cta}</p>}
        {content.hashtags?.length > 0 && <p className="text-[11px] text-zinc-500">{content.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}</p>}
      </div>
    </div>
  );
}

export default function PublicationStudio() {
  const available = useContentGenerationAvailable();
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<PublicationInput['format']>('post');
  const [platforms, setPlatforms] = useState<string[]>(['Instagram']);
  const [tone, setTone] = useState<PublicationInput['tone']>('profesional');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [includeCta, setIncludeCta] = useState(true);
  const [includeMentions, setIncludeMentions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<ContentRow<GeneratedPublication> | null>(null);

  const togglePlatform = (p: string) => setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    const res = await generatePublication({ prompt: prompt.trim(), format, platforms, tone, includeHashtags, includeEmoji, includeCta, includeMentions });
    setGenerating(false);
    if (res.error || !res.data) { setError(res.error || 'No se pudo generar la publicación.'); return; }
    const row = await createContent('publication', format, res.data.headline || prompt.slice(0, 60), prompt, res.data);
    if (!row) { setError('Se generó pero no se pudo guardar.'); return; }
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
            placeholder="Ej: una publicación anunciando las nuevas oportunidades activas"
            style={{ fontSize: 16 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] resize-y" />
          <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1">
            {PUBLICATION_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => setPrompt(t.prompt)} style={{ minHeight: 36 }}
                className="flex-shrink-0 text-[11px] font-semibold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 rounded-full px-3 cursor-pointer whitespace-nowrap">
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Tipo</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as PublicationInput['format'])}
              style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 cursor-pointer">
              {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Tono</label>
            <select value={tone} onChange={(e) => setTone(e.target.value as PublicationInput['tone'])}
              style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 cursor-pointer">
              {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Plataformas</label>
          <div className="flex gap-1.5 flex-wrap">
            {ALL_PLATFORMS.map((p) => (
              <button key={p} onClick={() => togglePlatform(p)}
                className={`px-3 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${platforms.includes(p) ? 'text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400'}`}
                style={platforms.includes(p) ? { background: `${ACCENT}33`, borderColor: ACCENT, minHeight: 36 } : { minHeight: 36 }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {([['Hashtags', includeHashtags, setIncludeHashtags], ['Emoji', includeEmoji, setIncludeEmoji], ['CTA', includeCta, setIncludeCta], ['Menciones', includeMentions, setIncludeMentions]] as const).map(([label, val, setter]) => (
            <label key={label} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} className="w-4 h-4 cursor-pointer" style={{ accentColor: ACCENT }} />
              {label}
            </label>
          ))}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button onClick={generate} disabled={generating || !prompt.trim() || available === false} style={{ minHeight: 44, background: ACCENT }}
          className="w-full flex items-center justify-center gap-2 text-zinc-900 text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {generating
            ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> Generando...</>
            : <>✨ Generar publicación</>}
        </button>
        {available === false && (
          <p className="text-[11px] text-[#C9A84C] flex items-center gap-1.5"><i className="ri-time-line"></i>IA disponible pronto: falta la clave de Anthropic en el servidor.</p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mb-3">Biblioteca de publicaciones</p>
        <ContentLibrary<GeneratedPublication> type="publication" refreshKey={refreshKey} onOpen={setEditing} accent={ACCENT}
          subtypeLabel={(s) => FORMATS.find((f) => f.value === s)?.label || s || ''} />
      </div>

      {editing && (
        <ContentEditorModal<GeneratedPublication>
          row={editing} accent={ACCENT} available={available === true}
          onClose={() => setEditing(null)}
          onSaved={(r) => { setEditing(r); setRefreshKey((k) => k + 1); }}
          onGenerateVariation={(content) => generateVariation<GeneratedPublication>('publication', content)}
          renderFields={(content, setContent) => (
            <div className="space-y-3">
              <input value={content.headline} placeholder="Titular" onChange={(e) => setContent({ ...content, headline: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
              <textarea value={content.body} placeholder="Cuerpo" rows={5} onChange={(e) => setContent({ ...content, body: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2 resize-y" />
              <input value={content.cta} placeholder="CTA" onChange={(e) => setContent({ ...content, cta: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
              <input value={content.hashtags.join(' ')} placeholder="#hashtags" onChange={(e) => setContent({ ...content, hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
              <input value={content.emoji} placeholder="Emoji" onChange={(e) => setContent({ ...content, emoji: e.target.value })}
                className="w-24 bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
            </div>
          )}
          renderPreview={(content) => <PublicationPreview content={content} />}
        />
      )}
    </div>
  );
}

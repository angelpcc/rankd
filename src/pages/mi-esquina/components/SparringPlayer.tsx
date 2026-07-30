import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';
import VoiceButton from '@/components/feature/VoiceButton';

export interface SparringLite {
  id: string;
  session_date: string;
  rounds: number;
  round_minutes: number;
  partner: string | null;
  video_path: string | null;
  video_url: string | null;
  video_kind: string | null;
}

interface Note {
  id: string;
  ts_seconds: number | null;
  body: string;
  created_at: string;
}

interface Props {
  profile: Profile;
  sparring: SparringLite;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onBack: () => void;
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Devuelve una URL embebible (YouTube/Vimeo) o null si no se reconoce. */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === 'youtube.com' && u.pathname.startsWith('/embed/')) return url;
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { /* url inválida */ }
  return null;
}

/**
 * Reproductor de sparring dentro de la app + notas ancladas al momento del
 * vídeo. Los vídeos subidos y los enlaces directos usan <video> nativo, así
 * que la nota puede saltar al segundo exacto. Los embeds de YouTube/Vimeo se
 * reproducen aquí mismo, pero sus notas quedan a nivel de sesión (sin salto).
 */
export default function SparringPlayer({ profile, sparring, showToast, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [loadingSrc, setLoadingSrc] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesUnavailable, setNotesUnavailable] = useState(false);
  const [body, setBody] = useState('');
  const [attachTime, setAttachTime] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [saving, setSaving] = useState(false);

  const isUpload = sparring.video_kind === 'upload' && !!sparring.video_path;
  const external = sparring.video_url || '';
  const embed = !isUpload && external ? embedUrl(external) : null;
  const directFile = !isUpload && external && VIDEO_EXT.test(external) ? external : null;
  // ¿Hay un <video> nativo? Solo entonces las notas pueden saltar al segundo.
  const nativePlayer = isUpload || !!directFile;

  // URL del vídeo: firmada para subidas privadas, directa para enlaces.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSrc(true);
      if (isUpload && sparring.video_path) {
        const { data, error } = await supabase.storage.from('sparring-videos').createSignedUrl(sparring.video_path, 3600);
        if (!cancelled) { setSrc(error ? null : data?.signedUrl || null); setLoadingSrc(false); }
      } else if (directFile) {
        if (!cancelled) { setSrc(directFile); setLoadingSrc(false); }
      } else {
        if (!cancelled) { setSrc(null); setLoadingSrc(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [isUpload, sparring.video_path, directFile]);

  const loadNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('sparring_notes').select('*')
      .eq('sparring_id', sparring.id)
      .order('ts_seconds', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (isMissingTable(error)) { setNotesUnavailable(true); return; }
    setNotes((data || []) as Note[]);
  }, [sparring.id]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const addNote = async () => {
    if (!body.trim() || saving) return;
    setSaving(true);
    const ts = nativePlayer && attachTime ? Math.floor(currentTime) : null;
    const { data, error } = await supabase.from('sparring_notes').insert({
      sparring_id: sparring.id,
      fighter_profile_id: profile.id,
      ts_seconds: ts,
      body: body.trim(),
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setNotes((prev) => [...prev, data as Note].sort((a, b) => (a.ts_seconds ?? -1) - (b.ts_seconds ?? -1)));
    setBody('');
    showToast(t('mc_sv_note_saved'));
  };

  const removeNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from('sparring_notes').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); loadNotes(); }
  };

  const seekTo = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = s;
    v.play().catch(() => { /* el navegador puede bloquear autoplay */ });
  };

  const dateLabel = new Date(sparring.session_date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer flex-shrink-0">
          <i className="ri-arrow-left-line text-lg"></i>
        </button>
        <div className="min-w-0">
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)', color: '#fff', margin: 0 }}>
            {sparring.rounds} × {sparring.round_minutes} min
            {sparring.partner ? <span className="text-zinc-400 font-normal text-base"> · {t('mc_sp_with')} {sparring.partner}</span> : ''}
          </h2>
          <p className="text-zinc-500 text-sm capitalize">{dateLabel}</p>
        </div>
      </div>

      {/* Reproductor */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black" style={{ aspectRatio: '16 / 9' }}>
        {loadingSrc ? (
          <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : nativePlayer && src ? (
          <video ref={videoRef} src={src} controls playsInline className="w-full h-full"
            onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)} />
        ) : embed ? (
          <iframe src={embed} title="sparring" className="w-full h-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        ) : external ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <i className="ri-external-link-line text-3xl text-zinc-500"></i>
            <p className="text-sm text-zinc-400">{t('mc_sv_external_only')}</p>
            <a href={external} target="_blank" rel="noopener noreferrer" className="rk-btn rk-btn-primary" style={{ fontSize: '0.85rem' }}>{t('mc_sv_open_link')}</a>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
            <i className="ri-video-off-line text-3xl text-zinc-600"></i>
            <p className="text-sm text-zinc-500">{t('mc_sv_no_video')}</p>
          </div>
        )}
      </div>

      {/* Notas */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <i className="ri-sticky-note-line text-red-400"></i>
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-500">{t('mc_sv_notes_title')}</p>
        </div>

        {notesUnavailable ? (
          <div className="rk-card text-center text-zinc-500 text-sm" style={{ padding: '20px 16px' }}>{t('mc_coming_soon_desc')}</div>
        ) : (
          <>
            {/* Añadir nota */}
            <div className="rk-card space-y-2.5" style={{ padding: 16 }}>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={400}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                placeholder={t('mc_sv_note_ph')} />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                <VoiceButton onResult={(txt) => setBody((prev) => (prev.trim() ? prev + ' ' + txt : txt))} compact />
                {nativePlayer ? (
                  <button onClick={() => setAttachTime((v) => !v)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${attachTime ? 'text-red-400 bg-red-600/10 border-red-500/30' : 'text-zinc-500 border-white/10'}`}>
                    <i className={attachTime ? 'ri-time-fill' : 'ri-time-line'}></i>
                    {attachTime ? t('mc_sv_at_time', { time: fmt(currentTime) }) : t('mc_sv_no_time')}
                  </button>
                ) : <span className="text-[11px] text-zinc-600">{t('mc_sv_session_note')}</span>}
                </div>
                <button onClick={addNote} disabled={saving || !body.trim()} className="rk-btn rk-btn-primary disabled:opacity-50" style={{ fontSize: '0.8rem', padding: '0.5rem 1.1rem' }}>
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : t('mc_sv_add_note')}
                </button>
              </div>
            </div>

            {/* Lista de notas */}
            {notes.length > 0 && (
              <div className="space-y-2 mt-3">
                {notes.map((n) => (
                  <div key={n.id} className="rk-card group flex items-start gap-3" style={{ padding: '12px 14px' }}>
                    {n.ts_seconds != null ? (
                      <button onClick={() => nativePlayer && seekTo(n.ts_seconds as number)}
                        className={`flex-shrink-0 text-[11px] font-bold tabular-nums px-2 py-1 rounded-md border ${nativePlayer ? 'text-red-400 bg-red-600/10 border-red-500/30 cursor-pointer hover:bg-red-600/20' : 'text-zinc-500 border-white/10'}`}>
                        <i className="ri-play-mini-line"></i> {fmt(n.ts_seconds)}
                      </button>
                    ) : (
                      <span className="flex-shrink-0 text-[11px] text-zinc-600 px-2 py-1"><i className="ri-sticky-note-line"></i></span>
                    )}
                    <p className="flex-1 min-w-0 text-sm text-zinc-200 leading-relaxed">{n.body}</p>
                    <button onClick={() => removeNote(n.id)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

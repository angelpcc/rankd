import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface PlanPhoto {
  id: string;
  file_path: string;
  notes: string | null;
  created_at: string;
}

// Reutiliza el bucket privado 'fighter-docs' (migración 0016): mismas
// políticas por carpeta <uid>/..., solo cambia el subdirectorio.
const BUCKET = 'fighter-docs';
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * "Sube la foto de tu plan real": el peleador guarda la foto del papel o
 * mensaje que le dio su entrenador, para tenerla a mano en el gimnasio. Es
 * SOLO almacenamiento — nada la interpreta todavía (eso llega después, con
 * la clave de IA activa). Vive en Agenda › Plan, junto a lo que toca hacer.
 */
export default function TrainerPlanUpload({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [photos, setPhotos] = useState<PlanPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const signUrls = useCallback(async (rows: PlanPhoto[]) => {
    const paths = rows.map((r) => r.file_path);
    if (paths.length === 0) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (!data) return;
    const map: Record<string, string> = {};
    data.forEach((d, i) => { if (d.signedUrl) map[paths[i]] = d.signedUrl; });
    setUrls((prev) => ({ ...prev, ...map }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trainer_plan_photos')
      .select('*')
      .eq('fighter_profile_id', profile.id)
      .order('created_at', { ascending: false });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    const rows = (data || []) as PlanPhoto[];
    setPhotos(rows);
    setLoading(false);
    signUrls(rows);
  }, [profile.id, signUrls]);

  useEffect(() => { load(); }, [load]);

  const onPickFile = (f: File | null) => {
    if (!f) { setFile(null); setPreview(null); return; }
    if (!ACCEPT.split(',').includes(f.type)) { showToast(t('mc_tp_err_type'), 'error'); return; }
    if (f.size > MAX_BYTES) { showToast(t('mc_tp_err_size'), 'error'); return; }
    setFile(f);
    setPreview(f.type === 'application/pdf' ? null : URL.createObjectURL(f));
  };

  const resetForm = () => { setFile(null); setPreview(null); setNotes(''); };

  const upload = async () => {
    if (!file || saving) return;
    setSaving(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filePath = `${profile.id}/plans/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, file);
    if (upErr) { setSaving(false); showToast(t('mc_tp_upload_fail'), 'error'); return; }

    const { data, error } = await supabase.from('trainer_plan_photos')
      .insert({ fighter_profile_id: profile.id, file_path: filePath, notes: notes.trim() || null })
      .select().maybeSingle();
    setSaving(false);
    if (error || !data) {
      await supabase.storage.from(BUCKET).remove([filePath]);
      showToast(t('mc_tp_save_fail'), 'error');
      return;
    }
    const row = data as PlanPhoto;
    setPhotos((prev) => [row, ...prev]);
    signUrls([row]);
    setShowForm(false);
    resetForm();
    showToast(t('mc_tp_saved'));
  };

  const remove = async (photo: PlanPhoto) => {
    const { error } = await supabase.from('trainer_plan_photos').delete().eq('id', photo.id);
    if (error) { showToast(t('mc_tp_delete_fail'), 'error'); return; }
    await supabase.storage.from(BUCKET).remove([photo.file_path]);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setConfirmDelete(null);
    showToast(t('mc_tp_deleted'));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin"></div></div>;
  }
  if (unavailable) return null;

  return (
    <div className="rk-card" style={{ padding: '18px 20px', transform: 'none' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C] flex-shrink-0">
            <i className="ri-image-2-line"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{t('mc_tp_title')}</h3>
            <p className="text-xs text-zinc-500">{t('mc_tp_sub')}</p>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="rk-btn rk-btn-ghost flex items-center gap-1.5 flex-shrink-0" style={{ fontSize: '0.78rem', padding: '0.55rem 1rem' }}>
            <i className="ri-camera-line"></i>{t('mc_tp_add')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
          <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 cursor-pointer transition-colors ${file ? 'border-green-500/40 bg-green-500/5' : 'border-white/15 bg-white/[0.02] hover:border-white/30'}`}>
            {preview ? (
              <img src={preview} alt="" className="max-h-40 rounded-lg object-contain" />
            ) : file ? (
              <><i className="ri-file-text-line text-2xl text-green-400"></i><span className="text-xs text-zinc-300">{file.name}</span></>
            ) : (
              <><i className="ri-camera-line text-2xl text-zinc-500"></i><span className="text-xs text-zinc-400">{t('mc_tp_pick_hint')}</span></>
            )}
            <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] || null)} />
          </label>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
            placeholder={t('mc_tp_notes_ph')}
            className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] resize-none" />

          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); resetForm(); }}
              className="py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-500 transition-colors cursor-pointer">
              {t('mc_tp_cancel')}
            </button>
            <button onClick={upload} disabled={!file || saving}
              className="flex-1 rk-btn rk-btn-primary disabled:opacity-50" style={{ fontSize: '0.85rem' }}>
              {saving ? t('mc_tp_saving') : t('mc_tp_save')}
            </button>
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {photos.map((p) => {
            const url = urls[p.file_path];
            const isPdf = p.file_path.toLowerCase().endsWith('.pdf');
            const dateNice = new Date(p.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <div key={p.id} className="relative group rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]">
                <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-black/30 flex items-center justify-center">
                  {isPdf ? (
                    <i className="ri-file-pdf-2-line text-3xl text-red-400"></i>
                  ) : url ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </a>
                <div className="p-2">
                  <p className="text-[10px] text-zinc-500">{dateNice}</p>
                  {p.notes && <p className="text-[11px] text-zinc-300 mt-0.5 line-clamp-2">{p.notes}</p>}
                </div>
                {confirmDelete === p.id ? (
                  <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-2 p-2">
                    <p className="text-[10px] text-zinc-300 text-center">{t('mc_tp_delete_confirm')}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => remove(p)} className="text-[10px] font-bold text-red-300 bg-red-600/20 border border-red-500/40 rounded-lg px-2.5 py-1 cursor-pointer">{t('mc_tp_delete_yes')}</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-zinc-400 px-2 py-1 cursor-pointer">{t('mc_tp_cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(p.id)} aria-label={t('mc_tp_delete')}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-zinc-300 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="ri-close-line text-sm"></i>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {photos.length === 0 && !showForm && (
        <p className="text-xs text-zinc-600 mt-3">{t('mc_tp_empty')}</p>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, OrgGalleryImage, Profile } from '@/lib/supabase';
import { useImageUpload } from '@/hooks/useImageUpload';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const GALLERY_CATEGORIES = [
  { value: 'instalaciones', labelKey: 'gg_cat_instalaciones' },
  { value: 'ring', labelKey: 'gg_cat_ring' },
  { value: 'entrenamiento', labelKey: 'gg_cat_entrenamiento' },
  { value: 'ambiente', labelKey: 'gg_cat_ambiente' },
  { value: 'equipo', labelKey: 'gg_cat_equipo' },
  { value: 'general', labelKey: 'gg_cat_general' },
];
const CAT_LABEL_KEYS: Record<string, string> = Object.fromEntries(GALLERY_CATEGORIES.map((c) => [c.value, c.labelKey]));

const MAX_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export default function GymGallery({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const [images, setImages] = useState<OrgGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [lightbox, setLightbox] = useState<OrgGalleryImage | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploading, uploadImage, deleteImage } = useImageUpload({
    bucket: 'gym-gallery',
    folder: profile.id,
  });

  const fetchImages = useCallback(async () => {
    const { data } = await supabase
      .from('organization_gallery')
      .select('*')
      .eq('org_profile_id', profile.id)
      .order('created_at', { ascending: false });
    setImages(data || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED.includes(file.type)) return t('gg_err_type');
    if (file.size > MAX_MB * 1024 * 1024) return t('gg_err_size', { n: MAX_MB });
    return null;
  };

  const handleFileSelected = (file: File) => {
    const err = validateFile(file);
    if (err) { setFileError(err); return; }
    setFileError(null);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleAdd = async () => {
    if (!pendingFile) { showToast(t('gg_toast_select'), 'error'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast(t('gg_toast_noauth'), 'error'); return; }

      const url = await uploadImage(pendingFile);
      if (!url) { showToast(t('gg_toast_upload_err'), 'error'); setSaving(false); return; }

      const { error } = await supabase.from('organization_gallery').insert({
        user_id: user.id,
        org_profile_id: profile.id,
        image_url: url,
        caption: caption.trim() || null,
        category: category || 'general',
      });
      if (error) throw error;

      showToast(t('gg_toast_added'));
      setPendingFile(null);
      setPreviewUrl(null);
      setCaption('');
      setCategory('general');
      setShowForm(false);
      fetchImages();
    } catch {
      showToast(t('gg_toast_add_err'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (img: OrgGalleryImage) => {
    setDeletingId(img.id);
    await deleteImage(img.image_url);
    const { error } = await supabase.from('organization_gallery').delete().eq('id', img.id);
    if (error) {
      showToast(t('gg_toast_del_err'), 'error');
    } else {
      showToast(t('gg_toast_deleted'));
      setImages((prev) => prev.filter((i) => i.id !== img.id));
    }
    setDeletingId(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setPendingFile(null);
    setPreviewUrl(null);
    setCaption('');
    setCategory('general');
    setFileError(null);
  };

  const filtered = activeFilter === 'all' ? images : images.filter((img) => img.category === activeFilter);
  const isBusy = saving || uploading;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">{t('gg_title')}</h2>
          <p className="text-zinc-400 text-sm mt-1">{t('gg_subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-image-add-line"></i>
          {t('gg_add')}
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">{t('gg_modal_title')}</h3>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Drop zone */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('gg_photo')} <span className="text-red-400">*</span></label>
                <div
                  className={`relative h-48 rounded-xl overflow-hidden border-2 border-dashed transition-all cursor-pointer
                    ${dragOver ? 'border-emerald-500/60 bg-emerald-500/10' : previewUrl ? 'border-zinc-700' : 'border-zinc-700 hover:border-zinc-500'}
                  `}
                  onClick={() => !isBusy && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover object-top" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-colors flex items-center justify-center group">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
                          {uploading
                            ? <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            : <><div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"><i className="ri-camera-line text-white text-lg"></i></div><span className="text-white text-xs font-semibold">{t('gg_change_photo')}</span></>
                          }
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPendingFile(null); setPreviewUrl(null); }}
                        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors cursor-pointer z-10"
                      >
                        <i className="ri-close-line text-sm"></i>
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                      {uploading
                        ? <><div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><span className="text-zinc-400 text-xs">{t('gg_uploading')}</span></>
                        : <><div className="w-12 h-12 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><i className="ri-image-add-line text-2xl"></i></div><div className="text-center"><p className="text-sm font-semibold text-emerald-400">{t('gg_upload')}</p><p className="text-zinc-600 text-xs mt-0.5">{t('gg_drag')}</p></div></>
                      }
                    </div>
                  )}
                </div>
                {fileError && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><i className="ri-error-warning-line"></i>{fileError}</p>}
                <p className="text-xs text-zinc-600 mt-1">{t('gg_formats')}</p>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('gg_category')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {GALLERY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('gg_desc_optional')}</label>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"
                  placeholder={t('gg_desc_ph')}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={closeForm} disabled={isBusy} className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
                  {t('gg_cancel')}
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isBusy || !pendingFile}
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isBusy
                    ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>{uploading ? t('gg_uploading') : t('gg_saving')}</>
                    : <><i className="ri-image-add-line"></i> {t('gg_add')}</>
                  }
                </button>
              </div>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleInputChange} className="hidden" />
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 text-white cursor-pointer hover:bg-zinc-700 transition-colors" onClick={() => setLightbox(null)}>
            <i className="ri-close-line text-lg"></i>
          </button>
          <img src={lightbox.image_url} alt={lightbox.caption || ''} className="max-w-full max-h-[85vh] rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          {lightbox.caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/60 px-4 py-2 rounded-full whitespace-nowrap">{lightbox.caption}</p>
          )}
        </div>
      )}

      {/* Category filter */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setActiveFilter('all')} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${activeFilter === 'all' ? 'bg-emerald-500 text-zinc-900 border-emerald-500' : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}>
            {t('gg_all')} ({images.length})
          </button>
          {GALLERY_CATEGORIES.filter((c) => images.some((img) => img.category === c.value)).map((c) => (
            <button key={c.value} onClick={() => setActiveFilter(c.value)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${activeFilter === c.value ? 'bg-emerald-500 text-zinc-900 border-emerald-500' : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}>
              {t(c.labelKey)} ({images.filter((img) => img.category === c.value).length})
            </button>
          ))}
        </div>
      )}

      {/* Gallery grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : images.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5">
            <i className="ri-image-2-line text-3xl text-emerald-400"></i>
          </div>
          <h3 className="text-base font-bold text-white mb-2">{t('gg_empty_title')}</h3>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mb-6">
            {t('gg_empty_desc')}
          </p>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 text-sm font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-image-add-line"></i>
            {t('gg_add_first')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((img) => (
            <div key={img.id} className="group relative rounded-xl overflow-hidden bg-zinc-800 aspect-square cursor-pointer" onClick={() => setLightbox(img)}>
              <img src={img.image_url} alt={img.caption || ''} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                <div className="w-full p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                  {img.caption && <p className="text-white text-xs font-medium truncate">{img.caption}</p>}
                  {img.category && <span className="text-xs text-emerald-400 capitalize">{CAT_LABEL_KEYS[img.category] ? t(CAT_LABEL_KEYS[img.category]) : img.category}</span>}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                disabled={deletingId === img.id}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50"
              >
                {deletingId === img.id
                  ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  : <i className="ri-delete-bin-line text-xs"></i>
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

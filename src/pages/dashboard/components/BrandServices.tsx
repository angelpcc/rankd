import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, BrandService, Profile } from '@/lib/supabase';
import { useImageUpload } from '@/hooks/useImageUpload';
import ImageUploader from '@/components/base/ImageUploader';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const SERVICE_CATEGORIES = [
  'Patrocinio', 'Management', 'Nutrición',
  'Fisioterapia', 'Equipamiento para eventos', 'Otros',
];

const MODALITIES = [
  { value: 'online', labelKey: 'dash_bs_mod_online', icon: 'ri-wifi-line' },
  { value: 'presencial', labelKey: 'dash_bs_mod_presencial', icon: 'ri-map-pin-line' },
  { value: 'ambos', labelKey: 'dash_bs_mod_ambos', icon: 'ri-global-line' },
] as const;

const emptyForm = {
  title: '',
  description: '',
  category: '',
  price: '',
  modality: 'online' as 'online' | 'presencial' | 'ambos',
  location: '',
  contact_link: '',
};

export default function BrandServices({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const [services, setServices] = useState<BrandService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { uploading, uploadImage, deleteImage } = useImageUpload({
    bucket: 'brand-assets',
    folder: `${profile.id}/services`,
  });

  const fetchServices = useCallback(async () => {
    const { data } = await supabase
      .from('brand_services')
      .select('*')
      .eq('brand_profile_id', profile.id)
      .order('created_at', { ascending: false });
    setServices(data || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImagePreview(null);
    setPendingFile(null);
    setShowForm(true);
  };

  const openEdit = (s: BrandService) => {
    setEditingId(s.id);
    setForm({
      title: s.title,
      description: s.description || '',
      category: s.category || '',
      price: s.price || '',
      modality: s.modality || 'online',
      location: s.location || '',
      contact_link: s.contact_link || '',
    });
    setImagePreview(s.image_url || null);
    setPendingFile(null);
    setShowForm(true);
  };

  const handleImageSelected = (file: File) => {
    setPendingFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    setPendingFile(null);
    setImagePreview(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast(t('dash_bs_title_required'), 'error'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast(t('dash_bp_not_auth'), 'error'); return; }

      let finalImageUrl: string | null = imagePreview && !pendingFile ? imagePreview : null;
      if (pendingFile) {
        const url = await uploadImage(pendingFile);
        if (!url) { showToast(t('dash_bp_img_error'), 'error'); setSaving(false); return; }
        finalImageUrl = url;
      }

      const payload = {
        user_id: user.id,
        brand_profile_id: profile.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category || null,
        price: form.price.trim() || null,
        modality: form.modality,
        location: form.location.trim() || null,
        contact_link: form.contact_link.trim() || null,
        image_url: finalImageUrl,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('brand_services').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast(t('dash_bs_updated'));
      } else {
        const { error } = await supabase.from('brand_services').insert(payload);
        if (error) throw error;
        showToast(t('dash_bs_created'));
      }
      setShowForm(false);
      fetchServices();
    } catch {
      showToast(t('dash_bs_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: BrandService) => {
    setDeletingId(service.id);
    if (service.image_url) await deleteImage(service.image_url);
    const { error } = await supabase.from('brand_services').delete().eq('id', service.id);
    if (error) {
      showToast(t('dash_bp_delete_error'), 'error');
    } else {
      showToast(t('dash_bs_deleted'));
      setServices((prev) => prev.filter((s) => s.id !== service.id));
    }
    setDeletingId(null);
  };

  const isBusy = saving || uploading;

  const modalityLabel = (m: string) => { const mm = MODALITIES.find((x) => x.value === m); return mm ? t(mm.labelKey) : m; };
  const modalityIcon = (m: string) => MODALITIES.find((x) => x.value === m)?.icon || 'ri-global-line';

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">{t('dash_bs_title')}</h2>
          <p className="text-zinc-400 text-sm mt-1">{t('dash_bs_sub')}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          {t('dash_bs_add')}
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">{editingId ? t('dash_bs_edit') : t('dash_bs_new')}</h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Image */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bs_img_label')}</label>
                <ImageUploader
                  value={imagePreview}
                  onChange={handleImageSelected}
                  onClear={handleClearImage}
                  uploading={uploading}
                  label={t('dash_bs_img_upload')}
                  hint={t('dash_bp_img_hint')}
                  aspectRatio="landscape"
                  accentColor="yellow"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bs_title_label')} <span className="text-red-400">*</span></label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500"
                  placeholder={t('dash_bs_title_ph')}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bs_type')}</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">{t('dash_bs_select_type')}</option>
                  {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bp_desc')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 resize-none"
                  placeholder={t('dash_bs_desc_ph')}
                />
              </div>

              {/* Modality */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">{t('dash_bs_modality')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODALITIES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, modality: m.value }))}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${form.modality === m.value ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
                    >
                      <i className={`${m.icon} text-base`}></i>
                      {t(m.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bp_price')}</label>
                  <input
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500"
                    placeholder="Desde 50€"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('pev_location')}</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500"
                    placeholder="Madrid, España"
                    disabled={form.modality === 'online'}
                  />
                </div>
              </div>

              {/* Contact link */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bs_contact')}</label>
                <input
                  value={form.contact_link}
                  onChange={(e) => setForm((f) => ({ ...f, contact_link: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500"
                  placeholder="https://… · mailto:… · https://wa.me/…"
                />
                <p className="text-xs text-zinc-600 mt-1">{t('dash_bs_contact_hint')}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  disabled={isBusy}
                  className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {t('dash_bp_cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isBusy}
                  className="flex-[2] bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isBusy
                    ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>{uploading ? t('dash_bp_uploading') : t('dash_bp_saving')}</>
                    : <><i className="ri-save-line"></i>{editingId ? t('dash_bp_update') : t('dash_bs_create_btn')}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : services.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-5">
            <i className="ri-service-line text-3xl text-amber-400"></i>
          </div>
          <h3 className="text-base font-bold text-white mb-2">{t('dash_bs_empty_title')}</h3>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mb-6">
            {t('dash_bs_empty_desc')}
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 text-sm font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            {t('dash_bs_add_first')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {services.map((service) => (
            <div key={service.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors">
              {/* Image */}
              {service.image_url && (
                <div className="h-36 overflow-hidden">
                  <img src={service.image_url} alt={service.title} className="w-full h-full object-cover object-top" />
                </div>
              )}
              <div className="p-4">
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {service.category && (
                    <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full font-semibold">
                      {service.category}
                    </span>
                  )}
                  <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <i className={`${modalityIcon(service.modality)} text-xs`}></i>
                    {modalityLabel(service.modality)}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mb-1 line-clamp-1">{service.title}</h3>
                {service.description && (
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 mb-3">{service.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    {service.price && (
                      <span className="text-amber-400 font-bold text-sm">{service.price}</span>
                    )}
                    {service.location && (
                      <span className="text-zinc-600 text-xs flex items-center gap-1">
                        <i className="ri-map-pin-line"></i>{service.location}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {service.contact_link && (
                      <a
                        href={service.contact_link}
                        target="_blank"
                        rel="nofollow noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        <i className="ri-external-link-line text-sm"></i>
                      </a>
                    )}
                    <button
                      onClick={() => openEdit(service)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                      <i className="ri-edit-line text-sm"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(service)}
                      disabled={deletingId === service.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {deletingId === service.id
                        ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin"></div>
                        : <i className="ri-delete-bin-line text-sm"></i>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

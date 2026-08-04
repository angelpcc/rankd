import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, BrandProduct, Profile } from '@/lib/supabase';
import { useImageUpload } from '@/hooks/useImageUpload';
import ImageUploader from '@/components/base/ImageUploader';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const CATEGORIES = [
  'Guantes', 'Ropa deportiva', 'Protecciones', 'Suplementos',
  'Calzado', 'Sacos y equipamiento', 'Accesorios', 'Tecnología', 'Otro',
];

const emptyForm = {
  name: '',
  description: '',
  category: '',
  price: '',
  external_link: '',
};

export default function BrandProducts({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<BrandProduct[]>([]);
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
    folder: profile.id,
  });

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('brand_products')
      .select('*')
      .eq('brand_profile_id', profile.id)
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImagePreview(null);
    setPendingFile(null);
    setShowForm(true);
  };

  const openEdit = (p: BrandProduct) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category || '',
      price: p.price || '',
      external_link: p.external_link || '',
    });
    setImagePreview(p.image_url || null);
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
    if (!form.name.trim()) { showToast(t('dash_bp_name_required'), 'error'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast(t('dash_bp_not_auth'), 'error'); return; }

      let finalImageUrl: string | null = imagePreview && !pendingFile ? imagePreview : null;

      // Upload new image if selected
      if (pendingFile) {
        const url = await uploadImage(pendingFile);
        if (!url) { showToast(t('dash_bp_img_error'), 'error'); setSaving(false); return; }
        finalImageUrl = url;
      }

      const payload = {
        user_id: user.id,
        brand_profile_id: profile.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category || null,
        price: form.price.trim() || null,
        image_url: finalImageUrl,
        external_link: form.external_link.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('brand_products').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast(t('dash_bp_updated'));
      } else {
        const { error } = await supabase.from('brand_products').insert(payload);
        if (error) throw error;
        showToast(t('dash_bp_created'));
      }
      setShowForm(false);
      fetchProducts();
    } catch {
      showToast(t('dash_bp_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: BrandProduct) => {
    setDeletingId(product.id);
    // Delete image from storage if exists
    if (product.image_url) {
      await deleteImage(product.image_url);
    }
    const { error } = await supabase.from('brand_products').delete().eq('id', product.id);
    if (error) {
      showToast(t('dash_bp_delete_error'), 'error');
    } else {
      showToast(t('dash_bp_deleted'));
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    }
    setDeletingId(null);
  };

  const isBusy = saving || uploading;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">{t('dash_bp_title')}</h2>
          <p className="text-zinc-400 text-sm mt-1">{t('dash_bp_sub')}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          {t('dash_bp_add')}
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">{editingId ? t('dash_bp_edit') : t('dash_bp_new')}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Image upload */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bp_img_label')}</label>
                <ImageUploader
                  value={imagePreview}
                  onChange={handleImageSelected}
                  onClear={handleClearImage}
                  uploading={uploading}
                  label={t('dash_bp_img_upload')}
                  hint={t('dash_bp_img_hint')}
                  aspectRatio="landscape"
                  accentColor="yellow"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bp_name_label')} <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                  placeholder={t('dash_bp_name_ph')}
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bp_category')}</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500 cursor-pointer"
                >
                  <option value="">{t('dash_bp_select_cat')}</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bp_desc')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500 resize-none"
                  placeholder={t('dash_bp_desc_ph')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bp_price')}</label>
                  <input
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                    placeholder="€49.99"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('dash_bp_buy_link')}</label>
                  <input
                    value={form.external_link}
                    onChange={(e) => setForm((f) => ({ ...f, external_link: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-yellow-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} disabled={isBusy} className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
                  {t('dash_bp_cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isBusy}
                  className="flex-[2] bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isBusy
                    ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> {uploading ? t('dash_bp_uploading') : t('dash_bp_saving')}</>
                    : <><i className="ri-save-line"></i> {editingId ? t('dash_bp_update') : t('dash_bp_create_btn')}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-5">
            <i className="ri-shopping-bag-line text-3xl text-yellow-400"></i>
          </div>
          <h3 className="text-base font-bold text-white mb-2">{t('dash_bp_empty_title')}</h3>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mb-6">
            {t('dash_bp_empty_desc')}
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 text-sm font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            {t('dash_bp_add_first')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-zinc-700 transition-colors">
              {/* Image */}
              <div className="relative h-44 bg-zinc-800 overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <i className="ri-image-line text-4xl text-zinc-600"></i>
                  </div>
                )}
                {product.category && (
                  <span className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-sm text-yellow-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-yellow-500/20">
                    {product.category}
                  </span>
                )}
              </div>
              {/* Content */}
              <div className="p-4">
                <h3 className="text-sm font-bold text-white mb-1 truncate">{product.name}</h3>
                {product.description && (
                  <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 mb-3">{product.description}</p>
                )}
                <div className="flex items-center justify-between">
                  {product.price ? (
                    <span className="text-yellow-400 font-bold text-sm">{product.price}</span>
                  ) : (
                    <span className="text-zinc-600 text-xs">{t('dash_bp_no_price')}</span>
                  )}
                  <div className="flex items-center gap-1">
                    {product.external_link && (
                      <a
                        href={product.external_link}
                        target="_blank"
                        rel="nofollow noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        <i className="ri-external-link-line text-sm"></i>
                      </a>
                    )}
                    <button
                      onClick={() => openEdit(product)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                      <i className="ri-edit-line text-sm"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      disabled={deletingId === product.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {deletingId === product.id
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

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, OrgEvent, Profile } from '@/lib/supabase';
import { useImageUpload } from '@/hooks/useImageUpload';
import ImageUploader from '@/components/base/ImageUploader';
import BoutManager from './BoutManager';
// Venta interna desconectada: EventTicketsManager sigue en el repositorio por
// si algún día se activa, pero ya no se monta en la interfaz.

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const emptyForm = {
  title: '',
  description: '',
  event_date: '',
  location: '',
  external_link: '',
};

export default function PromoterEvents({ profile, showToast }: Props) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('published');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'past'>('all');
  const [cardEvent, setCardEvent] = useState<OrgEvent | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);


  const { uploading, uploadImage, deleteImage } = useImageUpload({
    bucket: 'event-posters',
    folder: profile.id,
  });

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('organization_events')
      .select('*')
      .eq('org_profile_id', profile.id)
      .order('event_date', { ascending: true });
    setEvents(data || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormStatus('published');
    setImagePreview(null);
    setPendingFile(null);
    setShowForm(true);
  };

  const openEdit = (ev: OrgEvent) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description || '',
      event_date: ev.event_date || '',
      location: ev.location || '',
      external_link: ev.external_link || '',
    });
    setFormStatus(ev.status === 'draft' ? 'draft' : 'published');
    setImagePreview(ev.image_url || null);
    setPendingFile(null);
    setShowForm(true);
  };

  // Publicar / pasar a borrador desde la tarjeta, sin abrir el formulario.
  const toggleStatus = async (ev: OrgEvent) => {
    const next = ev.status === 'draft' ? 'published' : 'draft';
    setTogglingId(ev.id);
    const { error } = await supabase.from('organization_events').update({ status: next, updated_at: new Date().toISOString() }).eq('id', ev.id);
    setTogglingId(null);
    if (error) { showToast(t('error_save'), 'error'); return; }
    setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, status: next } : e));
    showToast(next === 'published' ? t('evb_status_published') : t('evb_status_draft'));
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
    if (!form.title.trim()) { showToast('El título es obligatorio', 'error'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showToast('No autenticado', 'error'); return; }

      let finalImageUrl: string | null = imagePreview && !pendingFile ? imagePreview : null;

      if (pendingFile) {
        const url = await uploadImage(pendingFile);
        if (!url) { showToast('Error al subir el cartel', 'error'); setSaving(false); return; }
        finalImageUrl = url;
      }

      const payload = {
        user_id: user.id,
        org_profile_id: profile.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: finalImageUrl,
        event_date: form.event_date || null,
        location: form.location.trim() || null,
        external_link: form.external_link.trim() || null,
        status: formStatus,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('organization_events').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast('Evento actualizado');
      } else {
        const { error } = await supabase.from('organization_events').insert(payload);
        if (error) throw error;
        showToast('Evento creado');
      }
      setShowForm(false);
      fetchEvents();
    } catch {
      showToast('Error al guardar el evento', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: OrgEvent) => {
    setDeletingId(ev.id);
    if (ev.image_url) await deleteImage(ev.image_url);
    const { error } = await supabase.from('organization_events').delete().eq('id', ev.id);
    if (error) {
      showToast('Error al eliminar', 'error');
    } else {
      showToast('Evento eliminado');
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    }
    setDeletingId(null);
  };

  const formatDate = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    if (diffDays < 0) return { label: formatted, badge: 'Pasado', color: 'text-zinc-500 bg-zinc-800 border-zinc-700' };
    if (diffDays <= 7) return { label: formatted, badge: 'Esta semana', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
    if (diffDays <= 30) return { label: formatted, badge: 'Este mes', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
    return { label: formatted, badge: 'Próximo', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  };

  const isBusy = saving || uploading;

  const isPastEvent = (ev: OrgEvent) => !!ev.event_date && new Date(ev.event_date + 'T23:59:59') < new Date();
  const visibleEvents = events.filter((ev) => {
    if (filter === 'past') return isPastEvent(ev);
    if (filter === 'draft') return ev.status === 'draft';
    if (filter === 'published') return ev.status !== 'draft' && !isPastEvent(ev);
    return true;
  });

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Mis Eventos</h2>
          <p className="text-zinc-400 text-sm mt-1">Publica y gestiona los eventos de tu promotora</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          Crear evento
        </button>
      </div>

      {/* Filtro por estado */}
      {events.length > 0 && (
        <div className="flex gap-1.5 mb-5 overflow-x-auto">
          {(['all', 'published', 'draft', 'past'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${filter === f ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              {f === 'all' ? t('evb_filter_all') : f === 'published' ? t('evb_filter_published') : f === 'draft' ? t('evb_filter_draft') : t('evb_filter_past')}
            </button>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">{editingId ? 'Editar evento' : 'Nuevo evento'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Poster upload */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Cartel / imagen del evento</label>
                <ImageUploader
                  value={imagePreview}
                  onChange={handleImageSelected}
                  onClear={handleClearImage}
                  uploading={uploading}
                  label="Subir cartel del evento"
                  hint="JPG, PNG o WEBP · Máx. 5 MB"
                  aspectRatio="portrait"
                  accentColor="red"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Título del evento <span className="text-red-400">*</span></label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                  placeholder="Ej: Gala de Boxeo Madrid 2026"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                  placeholder="Describe el evento, cartel, categorías..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Fecha del evento</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Ubicación</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                    placeholder="Madrid, España"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('ev_label_ticket_url')}</label>
                <input
                  type="url"
                  inputMode="url"
                  value={form.external_link}
                  onChange={(e) => setForm((f) => ({ ...f, external_link: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500"
                  placeholder="https://tuweb.com/entradas"
                />
                <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{t('ev_hint_ticket_url')}</p>
              </div>

              {/* Visibilidad: borrador vs publicado */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('evb_visibility')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['published', 'draft'] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setFormStatus(s)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${formStatus === s ? (s === 'published' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-amber-500/15 border-amber-500/40 text-amber-400') : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}>
                      <i className={s === 'published' ? 'ri-global-line' : 'ri-draft-line'} />{s === 'published' ? t('evb_status_published') : t('evb_status_draft')}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{formStatus === 'published' ? t('evb_published_hint') : t('evb_draft_hint')}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} disabled={isBusy} className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isBusy}
                  className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isBusy
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>{uploading ? 'Subiendo cartel...' : 'Guardando...'}</>
                    : <><i className="ri-save-line"></i> {editingId ? 'Actualizar' : 'Crear evento'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Events list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 mb-5">
            <i className="ri-calendar-event-line text-3xl text-red-400"></i>
          </div>
          <h3 className="text-base font-bold text-white mb-2">Sin eventos publicados</h3>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mb-6">
            Publica tus próximas galas, veladas y eventos para que los peleadores y el público puedan verlos.
          </p>
          <button onClick={openCreate} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-add-line"></i>
            Crear primer evento
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleEvents.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm py-10">{t('evb_none_in_filter')}</p>
          ) : visibleEvents.map((ev) => {
            const dateInfo = formatDate(ev.event_date);
            const past = isPastEvent(ev);
            const isDraft = ev.status === 'draft';
            return (
              <div key={ev.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors">
                <div className="flex flex-col sm:flex-row">
                  {ev.image_url && (
                    <div className="sm:w-40 h-40 sm:h-auto flex-shrink-0 overflow-hidden">
                      <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-base font-bold text-white leading-snug">{ev.title}</h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setCardEvent(ev)} className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer" title={t('evb_manage_card')}>
                          <i className="ri-sword-line text-sm"></i><span className="text-xs font-semibold hidden sm:inline">{t('evb_card')}</span>
                        </button>
                        {!past && (
                          <button onClick={() => toggleStatus(ev)} disabled={togglingId === ev.id} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${isDraft ? 'bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25' : 'bg-zinc-800 text-zinc-400 hover:text-amber-400'}`} title={isDraft ? t('evb_publish') : t('evb_unpublish')}>
                            {togglingId === ev.id ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div> : <i className={isDraft ? 'ri-global-line text-sm' : 'ri-draft-line text-sm'}></i>}
                          </button>
                        )}
                        <button onClick={() => openEdit(ev)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer">
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(ev)}
                          disabled={deletingId === ev.id}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === ev.id
                            ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin"></div>
                            : <i className="ri-delete-bin-line text-sm"></i>
                          }
                        </button>
                      </div>
                    </div>
                    {ev.description && <p className="text-zinc-500 text-sm leading-relaxed line-clamp-2 mb-3">{ev.description}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${past ? 'text-zinc-500 bg-zinc-800 border-zinc-700' : isDraft ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}>
                        {past ? t('evb_status_past') : isDraft ? t('evb_status_draft') : t('evb_status_published')}
                      </span>
                      {dateInfo && (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${dateInfo.color}`}>{dateInfo.badge}</span>
                          <span className="text-xs text-zinc-500">{dateInfo.label}</span>
                        </div>
                      )}
                      {ev.location && (
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <i className="ri-map-pin-line"></i>{ev.location}
                        </span>
                      )}
                      {ev.external_link && (
                        <a href={ev.external_link} target="_blank" rel="nofollow noreferrer" className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <i className="ri-ticket-line"></i>{t('ev_tickets_title')}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gestor de cartelera de combates (pantalla completa) */}
      {cardEvent && (
        <BoutManager
          profile={profile}
          eventId={cardEvent.id}
          eventTitle={cardEvent.title}
          showToast={showToast}
          onClose={() => setCardEvent(null)}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Note {
  id: string;
  note_date: string;
  title: string;
  body: string | null;
  category: string;
  tags: string[] | null;
  source: string;
  pinned: boolean;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Libreta de notas técnicas: un espacio SIMPLE para apuntar lo que corrige el
 * entrenador (se olvida en dos días). Título + nota + fecha, con buscador. Sin
 * categorías ni etiquetas: es una libreta, no un gestor (R15-B7).
 * Los campos category/source/tags de la tabla se guardan con un valor fijo.
 */
export default function TechniqueNotes({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [noteDate, setNoteDate] = useState(todayISO());

  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('technique_notes').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('note_date', { ascending: false });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setItems((data || []) as Note[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setTitle(''); setBody(''); setNoteDate(todayISO()); };

  const create = async () => {
    if (!title.trim()) { showToast(t('mc_tn_note_title'), 'error'); return; }
    setSaving(true);
    // category/source se guardan con un valor fijo: la libreta ya no los usa.
    const { data, error } = await supabase.from('technique_notes').insert({
      fighter_profile_id: profile.id,
      note_date: noteDate,
      title: title.trim(),
      body: body.trim() || null,
      category: 'idea',
      source: 'propia',
      tags: null,
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((prev) => [data as Note, ...prev]);
    setShowForm(false);
    reset();
    showToast(t('mc_tn_saved'));
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from('technique_notes').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => n.title.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q));
  }, [items, query]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-book-open-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Cabecera ligera: la sección ya está dentro del hub Ring. */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">{t('mc_tn_title')} {t('mc_tn_title_2')}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{t('mc_tn_subtitle')}</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true); }}
          className="flex-shrink-0 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
          <i className="ri-add-line"></i> {t('mc_tn_new')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '40px 24px' }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-book-open-line text-2xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_tn_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_tn_empty_desc')}</p>
          <button onClick={() => { reset(); setShowForm(true); }} className="rk-btn rk-btn-primary mt-5" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
            {t('mc_tn_new')}
          </button>
        </div>
      ) : (
        <>
          {/* Buscador simple */}
          <div className="relative">
            <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('mc_tn_search')}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-red-500 transition-colors" />
            {query && (
              <button onClick={() => setQuery('')} aria-label={t('mc_close')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer">
                <i className="ri-close-circle-fill text-sm"></i>
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="rk-card text-center" style={{ padding: '32px 24px' }}>
              <i className="ri-search-eye-line text-3xl text-zinc-700"></i>
              <p className="text-sm text-zinc-400 mt-3">{t('mc_tn_no_results')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => (
                <div key={n.id} className="rk-card group" style={{ padding: '14px 16px' }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white leading-snug">{n.title}</p>
                      {n.body && <p className="text-xs text-zinc-400 mt-1 leading-relaxed whitespace-pre-wrap">{n.body}</p>}
                      <p className="text-[11px] text-zinc-600 mt-1.5">
                        {new Date(n.note_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <button onClick={() => remove(n.id)} aria-label={t('mc_delete')}
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal nueva nota: título + nota + fecha */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" style={{ padding: 24, transform: 'none' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{t('mc_tn_new')}</h3>
              <button onClick={() => setShowForm(false)} aria-label={t('mc_close')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_tn_note_title')}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={90} placeholder={t('mc_tn_note_title_ph')}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {t('mc_tn_body')} <span className="text-zinc-600">({t('mc_optional')})</span>
                </label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={800} placeholder={t('mc_tn_body_ph')}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-y leading-relaxed" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_tn_date')}</label>
                <input type="date" value={noteDate} max={todayISO()} onChange={(e) => setNoteDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
              </div>

              <button onClick={create} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
                  : <><i className="ri-book-open-line"></i> {t('mc_tn_save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

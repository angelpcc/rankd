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

const CATEGORIES = [
  { value: 'correccion', key: 'mc_tn_cat_correction', icon: 'ri-error-warning-line', color: '#E10600' },
  { value: 'tactica', key: 'mc_tn_cat_tactic', icon: 'ri-mind-map', color: '#38bdf8' },
  { value: 'idea', key: 'mc_tn_cat_idea', icon: 'ri-lightbulb-line', color: '#C9A84C' },
  { value: 'error', key: 'mc_tn_cat_error', icon: 'ri-repeat-line', color: '#fb923c' },
];

const catCfg = (v: string) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[0];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Libreta de notas técnicas: las correcciones del entrenador se olvidan en dos
 * días. Guardarlas y poder buscarlas antes de entrenar es la diferencia entre
 * repetir el error y corregirlo.
 */
export default function TechniqueNotes({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('correccion');
  const [source, setSource] = useState('coach');
  const [tags, setTags] = useState('');
  const [noteDate, setNoteDate] = useState(todayISO());

  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('technique_notes').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('pinned', { ascending: false })
      .order('note_date', { ascending: false });
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setItems((data || []) as Note[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setTitle(''); setBody(''); setCategory('correccion'); setSource('coach');
    setTags(''); setNoteDate(todayISO());
  };

  const create = async () => {
    if (!title.trim()) { showToast(t('mc_tn_note_title'), 'error'); return; }
    setSaving(true);
    const tagList = tags.split(',').map((s) => s.trim()).filter(Boolean);
    const { data, error } = await supabase.from('technique_notes').insert({
      fighter_profile_id: profile.id,
      note_date: noteDate,
      title: title.trim(),
      body: body.trim() || null,
      category,
      source,
      tags: tagList.length ? tagList : null,
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((prev) => [data as Note, ...prev]);
    setShowForm(false);
    reset();
    showToast(t('mc_tn_saved'));
  };

  const togglePin = async (n: Note) => {
    const next = !n.pinned;
    setItems((prev) => [...prev.map((x) => x.id === n.id ? { ...x, pinned: next } : x)]
      .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.note_date.localeCompare(a.note_date)));
    const { error } = await supabase.from('technique_notes').update({ pinned: next }).eq('id', n.id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from('technique_notes').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      if (catFilter !== 'all' && n.category !== catFilter) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q)
        || (n.body || '').toLowerCase().includes(q)
        || (n.tags || []).some((tg) => tg.toLowerCase().includes(q));
    });
  }, [items, query, catFilter]);

  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

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

  const NoteCard = ({ n }: { n: Note }) => {
    const cfg = catCfg(n.category);
    return (
      <div className="rk-card group" style={{ padding: '16px 18px' }}>
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border"
            style={{ background: `${cfg.color}14`, borderColor: `${cfg.color}40`, color: cfg.color }}>
            <i className={cfg.icon}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white leading-snug">{n.title}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}18`, color: cfg.color }}>{t(cfg.key)}</span>
              {n.source === 'coach' && (
                <span className="text-[10px] text-zinc-400 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full">{t('mc_tn_source_coach')}</span>
              )}
            </div>
            {n.body && <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed whitespace-pre-wrap">{n.body}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[11px] text-zinc-600">
                {new Date(n.note_date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {(n.tags || []).map((tg) => (
                <button key={tg} onClick={() => setQuery(tg)}
                  className="text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.08] hover:border-white/20 px-2 py-0.5 rounded-md cursor-pointer transition-colors">
                  #{tg}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={() => togglePin(n)} title={n.pinned ? t('mc_tn_unpin') : t('mc_tn_pin')}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${n.pinned ? 'text-[#C9A84C]' : 'text-zinc-600 hover:text-zinc-300'}`}>
              <i className={n.pinned ? 'ri-pushpin-fill' : 'ri-pushpin-line'}></i>
            </button>
            <button onClick={() => remove(n.id)} aria-label={t('mc_delete')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <i className="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('mc_tn_source_coach')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_tn_title')} <span className="rk-red-glow">{t('mc_tn_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_tn_subtitle')}</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true); }} className="rk-btn rk-btn-primary flex items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
          <i className="ri-add-line"></i> {t('mc_tn_new')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-book-open-line text-3xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_tn_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_tn_empty_desc')}</p>
          <button onClick={() => { reset(); setShowForm(true); }} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
            {t('mc_tn_new')}
          </button>
        </div>
      ) : (
        <>
          {/* Buscador + filtro por tipo */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
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
            <div className="flex gap-1.5 overflow-x-auto">
              <button onClick={() => setCatFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${catFilter === 'all' ? 'bg-red-600 border-red-600 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}>
                {t('mc_tn_filter_all')}
              </button>
              {CATEGORIES.map((c) => (
                <button key={c.value} onClick={() => setCatFilter(c.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${catFilter === c.value ? 'text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'}`}
                  style={catFilter === c.value ? { background: `${c.color}22`, borderColor: `${c.color}66` } : undefined}>
                  {t(c.key)}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rk-card text-center" style={{ padding: '40px 24px' }}>
              <i className="ri-search-eye-line text-3xl text-zinc-700"></i>
              <p className="text-sm text-zinc-400 mt-3">{t('mc_tn_no_results')}</p>
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-[#C9A84C] mb-2.5">{t('mc_tn_pinned')}</p>
                  <div className="space-y-2.5">{pinned.map((n) => <NoteCard key={n.id} n={n} />)}</div>
                </div>
              )}
              {rest.length > 0 && <div className="space-y-2.5">{rest.map((n) => <NoteCard key={n.id} n={n} />)}</div>}
            </>
          )}
        </>
      )}

      {/* Modal nueva nota */}
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
                <label className="block text-xs text-zinc-400 mb-2">{t('mc_tn_category')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.value} onClick={() => setCategory(c.value)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all cursor-pointer ${category === c.value ? 'border-white/30' : 'border-white/10 hover:border-white/20'}`}
                      style={{ background: category === c.value ? `${c.color}18` : 'rgba(255,255,255,0.02)' }}>
                      <i className={c.icon} style={{ color: c.color, fontSize: 15 }}></i>
                      <span className="text-[9px] font-semibold text-white text-center leading-tight">{t(c.key)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">{t('mc_tn_source')}</label>
                  <div className="flex gap-2">
                    {(['coach', 'propia'] as const).map((s) => (
                      <button key={s} onClick={() => setSource(s)}
                        className={`flex-1 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${source === s ? 'bg-red-600/20 border-red-500/60 text-white' : 'bg-white/[0.02] border-white/10 text-zinc-500'}`}>
                        {s === 'coach' ? t('mc_tn_source_coach') : t('mc_tn_source_self')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">{t('mc_tn_date')}</label>
                  <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {t('mc_tn_tags')} <span className="text-zinc-600">({t('mc_optional')})</span>
                </label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} maxLength={120} placeholder={t('mc_tn_tags_ph')}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
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

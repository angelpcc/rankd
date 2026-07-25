import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Sparring {
  id: string;
  session_date: string;
  rounds: number;
  round_minutes: number;
  partner: string | null;
  partner_level: string | null;
  intensity: number;
  what_worked: string | null;
  what_didnt: string | null;
  notes: string | null;
}

const LEVELS = [
  { value: 'similar', key: 'mc_sp_level_similar', color: '#38bdf8' },
  { value: 'mas_fuerte', key: 'mc_sp_level_stronger', color: '#E10600' },
  { value: 'mas_flojo', key: 'mc_sp_level_weaker', color: '#22c55e' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Registro de sparring — específico de deportes de combate y separado del
 * entreno normal a propósito: lo que pasa en el sparring es lo que más se
 * parece a pelear, y repasarlo antes de un combate vale más que cualquier
 * estadística de volumen.
 */
export default function SparringLog({ profile, showToast }: Props) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Sparring[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [rounds, setRounds] = useState('5');
  const [roundMin, setRoundMin] = useState('3');
  const [partner, setPartner] = useState('');
  const [level, setLevel] = useState('similar');
  const [intensity, setIntensity] = useState(3);
  const [worked, setWorked] = useState('');
  const [didnt, setDidnt] = useState('');
  const [notes, setNotes] = useState('');

  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sparring_sessions').select('*')
      .eq('fighter_profile_id', profile.id)
      .order('session_date', { ascending: false }).limit(60);
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setItems((data || []) as Sparring[]);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setDate(todayISO()); setRounds('5'); setRoundMin('3'); setPartner('');
    setLevel('similar'); setIntensity(3); setWorked(''); setDidnt(''); setNotes('');
  };

  const create = async () => {
    setSaving(true);
    const { data, error } = await supabase.from('sparring_sessions').insert({
      fighter_profile_id: profile.id,
      session_date: date,
      rounds: parseInt(rounds, 10) || 1,
      round_minutes: parseFloat(roundMin.replace(',', '.')) || 3,
      partner: partner.trim() || null,
      partner_level: level,
      intensity,
      what_worked: worked.trim() || null,
      what_didnt: didnt.trim() || null,
      notes: notes.trim() || null,
    }).select().maybeSingle();
    setSaving(false);
    if (error || !data) { showToast(t('error_save'), 'error'); return; }
    setItems((prev) => [data as Sparring, ...prev].sort((a, b) => b.session_date.localeCompare(a.session_date)));
    setShowForm(false);
    reset();
    showToast(t('mc_sp_saved'));
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from('sparring_sessions').delete().eq('id', id);
    if (error) { showToast(t('error_save'), 'error'); load(); }
  };

  // Cifras de los últimos 30 días: es la ventana que importa antes de pelear.
  const stats = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const sinceISO = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
    const recent = items.filter((x) => x.session_date >= sinceISO);
    return {
      sessions: recent.length,
      rounds: recent.reduce((a, x) => a + (x.rounds || 0), 0),
    };
  }, [items]);

  // Lo que has anotado como "qué no funcionó": la lista para repasar antes de pelear.
  const toReview = useMemo(
    () => items.filter((x) => x.what_didnt && x.what_didnt.trim()).slice(0, 5),
    [items]
  );

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '48px 28px' }}>
        <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/25 anim-float">
          <i className="ri-boxing-line text-3xl text-red-400"></i>
        </div>
        <h3 className="rk-h3" style={{ fontSize: '1.2rem', color: '#fff' }}>{t('mc_coming_soon_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{t('mc_coming_soon_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="rk-eyebrow">{t('mc_sp_last_30')}</p>
          <h2 className="rk-h2" style={{ fontSize: 'clamp(1.8rem,4vw,2.4rem)', color: '#fff', margin: '4px 0 0' }}>
            {t('mc_sp_title')} <span className="rk-red-glow">{t('mc_sp_title_2')}</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1.5 max-w-md">{t('mc_sp_subtitle')}</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true); }} className="rk-btn rk-btn-primary flex items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.7rem 1.4rem' }}>
          <i className="ri-add-line"></i> {t('mc_sp_new')}
        </button>
      </div>

      {/* Cifras */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div className="rk-card" style={{ padding: '16px 18px' }}>
            <i className="ri-boxing-line text-[#E10600]"></i>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, lineHeight: 1, color: '#fff', marginTop: 6 }}>{stats.rounds}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{t('mc_sp_total_rounds')}</p>
          </div>
          <div className="rk-card" style={{ padding: '16px 18px' }}>
            <i className="ri-calendar-check-line text-sky-400"></i>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, lineHeight: 1, color: '#fff', marginTop: 6 }}>{stats.sessions}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{t('mc_sp_sessions_count')}</p>
          </div>
        </div>
      )}

      {/* Para repasar antes de pelear */}
      {toReview.length > 0 && (
        <div className="rk-card" style={{ padding: '18px 20px', borderColor: 'rgba(251,146,60,0.25)', transform: 'none' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <i className="ri-alarm-warning-line text-orange-400"></i>
            <p className="text-sm font-bold text-white">{t('mc_sp_review_title')}</p>
          </div>
          <p className="text-xs text-zinc-500 mb-3">{t('mc_sp_review_desc')}</p>
          <ul className="space-y-1.5">
            {toReview.map((x) => (
              <li key={x.id} className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed">
                <i className="ri-arrow-right-s-line text-orange-400 mt-0.5 flex-shrink-0"></i>
                <span>{x.what_didnt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rk-card text-center" style={{ padding: '48px 28px' }}>
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
            <i className="ri-boxing-line text-3xl text-zinc-600"></i>
          </div>
          <p className="text-white font-bold">{t('mc_sp_empty')}</p>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto leading-relaxed">{t('mc_sp_empty_desc')}</p>
          <button onClick={() => { reset(); setShowForm(true); }} className="rk-btn rk-btn-primary mt-6" style={{ fontSize: '0.85rem', padding: '0.7rem 1.6rem' }}>
            {t('mc_sp_new')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((x) => {
            const lvl = LEVELS.find((l) => l.value === x.partner_level);
            return (
              <div key={x.id} className="rk-card group" style={{ padding: '18px 20px' }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 flex-shrink-0 flex flex-col items-center justify-center rounded-xl bg-red-600/12 border border-red-500/30">
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1, color: '#E10600' }}>{x.rounds}</span>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-wider">{t('mc_sp_rounds_short')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">
                        {x.rounds} × {x.round_minutes} min
                        {x.partner ? <span className="text-zinc-400 font-normal"> · {t('mc_sp_with')} {x.partner}</span> : ''}
                      </p>
                      {lvl && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: `${lvl.color}18`, borderColor: `${lvl.color}44`, color: lvl.color }}>
                          {t(lvl.key)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 capitalize">
                      {new Date(x.session_date + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                      {' · '}{'🔥'.repeat(Math.max(1, Math.min(5, x.intensity)))}
                    </p>

                    {(x.what_worked || x.what_didnt) && (
                      <div className="grid sm:grid-cols-2 gap-2 mt-3">
                        {x.what_worked && (
                          <div className="rounded-lg border border-green-500/20 bg-green-500/[0.06] px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-0.5">{t('mc_sp_worked')}</p>
                            <p className="text-xs text-zinc-300 leading-relaxed">{x.what_worked}</p>
                          </div>
                        )}
                        {x.what_didnt && (
                          <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-0.5">{t('mc_sp_didnt')}</p>
                            <p className="text-xs text-zinc-300 leading-relaxed">{x.what_didnt}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {x.notes && <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{x.notes}</p>}
                  </div>
                  <button onClick={() => remove(x.id)} aria-label={t('mc_delete')}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 transition-colors cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nuevo sparring */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative rk-card w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" style={{ padding: 24, transform: 'none' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="rk-h3" style={{ fontSize: '1.15rem', color: '#fff' }}>{t('mc_sp_new')}</h3>
              <button onClick={() => setShowForm(false)} aria-label={t('mc_close')}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-zinc-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_sp_date')}</label>
                  <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_sp_rounds')}</label>
                  <input value={rounds} onChange={(e) => setRounds(e.target.value)} inputMode="numeric"
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">{t('mc_sp_round_min')}</label>
                  <input value={roundMin} onChange={(e) => setRoundMin(e.target.value)} inputMode="decimal"
                    className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {t('mc_sp_partner')} <span className="text-zinc-600">({t('mc_optional')})</span>
                </label>
                <input value={partner} onChange={(e) => setPartner(e.target.value)} maxLength={60} placeholder={t('mc_sp_partner_ph')}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-2">{t('mc_sp_partner_level')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((l) => (
                    <button key={l.value} onClick={() => setLevel(l.value)}
                      className={`py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${level === l.value ? 'text-white' : 'text-zinc-500 border-white/10 hover:border-white/20'}`}
                      style={level === l.value ? { background: `${l.color}20`, borderColor: `${l.color}66` } : { background: 'rgba(255,255,255,0.02)' }}>
                      {t(l.key)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-2">{t('mc_sp_intensity')}</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setIntensity(v)}
                      className={`flex-1 py-2.5 rounded-lg border text-xs transition-all cursor-pointer ${intensity >= v ? 'bg-red-600/20 border-red-500/50' : 'bg-white/[0.02] border-white/10 opacity-40'}`}>
                      🔥
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-green-400 mb-1.5 font-semibold">{t('mc_sp_worked')}</label>
                <textarea value={worked} onChange={(e) => setWorked(e.target.value)} rows={2} maxLength={400} placeholder={t('mc_sp_worked_ph')}
                  className="w-full bg-white/[0.04] border border-green-500/20 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-green-500 resize-y" />
              </div>

              <div>
                <label className="block text-xs text-orange-400 mb-1.5 font-semibold">{t('mc_sp_didnt')}</label>
                <textarea value={didnt} onChange={(e) => setDidnt(e.target.value)} rows={2} maxLength={400} placeholder={t('mc_sp_didnt_ph')}
                  className="w-full bg-white/[0.04] border border-orange-500/20 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-orange-500 resize-y" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {t('mc_sp_notes')} <span className="text-zinc-600">({t('mc_optional')})</span>
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={400}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-y" />
              </div>

              <button onClick={create} disabled={saving} className="rk-btn rk-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontSize: '0.95rem' }}>
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('mc_saving')}</>
                  : <><i className="ri-boxing-line"></i> {t('mc_sp_save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

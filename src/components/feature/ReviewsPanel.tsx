import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, OrgReview } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isMissingTable } from '@/lib/dbState';

interface Props { orgId: string; }

interface ReviewRow extends OrgReview { name: string | null; avatar: string | null; }

function Stars({ value, size = 'text-base', onPick }: { value: number; size?: string; onPick?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n}
          onClick={onPick ? () => onPick(n) : undefined}
          className={`${n <= Math.round(value) ? 'ri-star-fill text-[#C9A84C]' : 'ri-star-line text-zinc-600'} ${size} ${onPick ? 'cursor-pointer hover:text-[#C9A84C]' : ''}`} />
      ))}
    </div>
  );
}

const REL_KEY: Record<string, string> = { application: 'rv_rel_application', bout: 'rv_rel_bout', roster: 'rv_rel_roster' };

export default function ReviewsPanel({ orgId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canRel, setCanRel] = useState<string | null>(null);   // relación acreditada
  const [mine, setMine] = useState<OrgReview | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const isFighter = profile?.user_type === 'fighter';

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('org_reviews').select('*')
      .eq('org_profile_id', orgId).order('created_at', { ascending: false });
    if (isMissingTable(error)) { setReviews([]); setLoading(false); return; }
    const rows = (data || []) as OrgReview[];
    const ids = [...new Set(rows.map((r) => r.reviewer_profile_id))];
    let nameMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids);
      nameMap = new Map((profs || []).map((p) => [p.id, p]));
    }
    setReviews(rows.map((r) => ({ ...r, name: nameMap.get(r.reviewer_profile_id)?.full_name ?? null, avatar: nameMap.get(r.reviewer_profile_id)?.avatar_url ?? null })));
    const own = rows.find((r) => r.reviewer_profile_id === profile?.id) || null;
    setMine(own);
    if (own) { setRating(own.rating); setComment(own.comment || ''); }
    setLoading(false);
  }, [orgId, profile?.id]);

  useEffect(() => { load(); }, [load]);

  // ¿Puede reseñar? Solo peleadores con relación acreditada (comprobado en servidor).
  useEffect(() => {
    if (!user || !isFighter || profile?.id === orgId) { setCanRel(null); return; }
    supabase.rpc('rk_can_review', { p_org: orgId }).then(({ data }) => setCanRel((data as string | null) || null));
  }, [user, isFighter, profile?.id, orgId]);

  const submit = async () => {
    if (rating < 1) { setNote(t('rv_rating_required')); return; }
    setSaving(true);
    const payload = { org_profile_id: orgId, reviewer_profile_id: profile!.id, rating, comment: comment.trim() || null, relationship: canRel, updated_at: new Date().toISOString() };
    const { error } = mine
      ? await supabase.from('org_reviews').update(payload).eq('id', mine.id)
      : await supabase.from('org_reviews').insert(payload);
    setSaving(false);
    if (error) { setNote(t('error_save')); return; }
    setNote(t('rv_saved'));
    load();
  };

  const remove = async () => {
    if (!mine) return;
    const { error } = await supabase.from('org_reviews').delete().eq('id', mine.id);
    if (!error) { setMine(null); setRating(0); setComment(''); setNote(t('rv_deleted')); load(); }
  };

  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="rk-h3 text-white flex items-center gap-2">{t('rv_reviews')}</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{avg.toFixed(1)}</span>
            <Stars value={avg} />
            <span className="text-xs text-zinc-500">· {reviews.length === 1 ? t('rv_count_one') : t('rv_count_n', { n: reviews.length })}</span>
          </div>
        )}
      </div>

      {/* Formulario de reseña — solo peleadores con relación acreditada */}
      {user && isFighter && profile?.id !== orgId && (
        canRel ? (
          <div className="rk-card space-y-3" style={{ padding: 18 }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">{mine ? t('rv_edit') : t('rv_leave')}</p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <i className="ri-shield-check-line" />{t(REL_KEY[canRel] || 'rv_verified')}
              </span>
            </div>
            <Stars value={rating} size="text-2xl" onPick={setRating} />
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={600}
              className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] resize-none" placeholder={t('rv_comment_ph')} />
            <div className="flex items-center gap-2">
              <button onClick={submit} disabled={saving} className="rk-btn rk-btn-primary flex items-center gap-2 disabled:opacity-60" style={{ fontSize: '0.85rem' }}>
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <i className="ri-star-line" />}
                {mine ? t('rv_update') : t('rv_submit')}
              </button>
              {mine && <button onClick={remove} className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer">{t('rv_delete')}</button>}
              {note && <span className="text-xs text-zinc-400">{note}</span>}
            </div>
          </div>
        ) : (
          <div className="rk-card text-xs text-zinc-500 flex items-center gap-2" style={{ padding: 14 }}>
            <i className="ri-lock-line" />{t('rv_cannot')}
          </div>
        )
      )}
      {!user && (
        <button onClick={() => navigate('/auth')} className="rk-card w-full text-left text-xs text-zinc-400 hover:text-white flex items-center gap-2 cursor-pointer" style={{ padding: 14 }}>
          <i className="ri-login-circle-line" />{t('rv_login')}
        </button>
      )}

      {/* Lista de reseñas */}
      {loading ? (
        <div className="flex items-center justify-center py-10"><div className="w-7 h-7 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-zinc-500">{t('rv_no_reviews')}</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rk-card" style={{ padding: 16 }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" /> : <i className="ri-user-line text-zinc-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{r.name || '—'}</p>
                  <Stars value={r.rating} size="text-xs" />
                </div>
                {r.relationship && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 flex-shrink-0">
                    <i className="ri-shield-check-line" />{t('rv_verified')}
                  </span>
                )}
              </div>
              {r.comment && <p className="text-sm text-zinc-300 leading-relaxed mt-2.5">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

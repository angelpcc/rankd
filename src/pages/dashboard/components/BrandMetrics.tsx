import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

interface Props { profile: Profile; }

interface Ev { kind: string; product_id: string | null; created_at: string; }

function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export default function BrandMetrics({ profile }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [events, setEvents] = useState<Ev[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data, error } = await supabase.from('brand_events')
      .select('kind, product_id, created_at')
      .eq('org_profile_id', profile.id)
      .gte('created_at', since.toISOString());
    if (isMissingTable(error)) { setUnavailable(true); setLoading(false); return; }
    setEvents((data || []) as Ev[]);
    // Nombres de producto para el desglose de clics
    const { data: prods } = await supabase.from('brand_products').select('id, name').eq('brand_profile_id', profile.id);
    setProductNames(Object.fromEntries((prods || []).map((p) => [p.id, p.name])));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (unavailable) {
    return (
      <div className="rk-card text-center max-w-lg mx-auto" style={{ padding: '40px 24px' }}>
        <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-[#C9A84C]/12 border border-[#C9A84C]/28"><i className="ri-line-chart-line text-2xl text-[#C9A84C]" /></div>
        <p className="text-sm text-zinc-400 leading-relaxed">{t('dash_bm_unavailable')}</p>
      </div>
    );
  }

  const views = events.filter((e) => e.kind === 'view').length;
  const webClicks = events.filter((e) => e.kind === 'website_click').length;
  const productClicks = events.filter((e) => e.kind === 'product_click').length;
  const totalClicks = webClicks + productClicks;
  const interest = views > 0 ? Math.round((totalClicks / views) * 100) : 0;

  // Clics por producto
  const byProduct = new Map<string, number>();
  events.filter((e) => e.kind === 'product_click' && e.product_id).forEach((e) => {
    byProduct.set(e.product_id!, (byProduct.get(e.product_id!) || 0) + 1);
  });
  const productRows = [...byProduct.entries()].map(([id, n]) => ({ id, n, name: productNames[id] || '—' })).sort((a, b) => b.n - a.n);
  const maxProd = Math.max(1, ...productRows.map((r) => r.n));

  // Tendencia 14 días (vistas + clics)
  const trend: { key: string; views: number; clicks: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const dayEvents = events.filter((e) => e.created_at.slice(0, 10) === key);
    trend.push({ key, views: dayEvents.filter((e) => e.kind === 'view').length, clicks: dayEvents.filter((e) => e.kind !== 'view').length });
  }
  const maxTrend = Math.max(1, ...trend.map((d) => Math.max(d.views, d.clicks)));

  const hasData = events.length > 0;

  const KPIS = [
    { label: t('dash_bm_views'), value: views, icon: 'ri-eye-line', color: 'text-[#C9A84C]', bg: 'bg-[#C9A84C]/12 border-[#C9A84C]/28' },
    { label: t('dash_bm_web_clicks'), value: webClicks, icon: 'ri-external-link-line', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/25' },
    { label: t('dash_bm_product_clicks'), value: productClicks, icon: 'ri-shopping-cart-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
    { label: t('dash_bm_interest'), value: `${interest}%`, icon: 'ri-focus-2-line', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="rk-h3 text-white">{t('dash_bm_title')}</h2>
          <p className="text-zinc-400 text-sm mt-1">{t('dash_bm_sub')}</p>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-full">{t('dash_bm_last30')}</span>
      </div>

      {!hasData ? (
        <div className="rk-card text-center" style={{ padding: '48px 24px' }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-[#C9A84C]/12 border border-[#C9A84C]/28"><i className="ri-bar-chart-box-line text-2xl text-[#C9A84C]" /></div>
          <h3 className="text-base font-bold text-white">{t('dash_bm_empty_title')}</h3>
          <p className="text-sm text-zinc-500 mt-1.5 max-w-xs mx-auto">{t('dash_bm_empty_desc')}</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {KPIS.map((k) => (
              <div key={k.label} className="rk-card p-5">
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl border mb-3 ${k.bg} ${k.color}`}><i className={`${k.icon} text-lg`} /></div>
                <p className={k.color} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1 }}>{k.value}</p>
                <p className="text-[11px] text-zinc-400 mt-1.5 uppercase tracking-wider leading-tight">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Tendencia */}
          <div className="rk-card" style={{ padding: '18px 20px' }}>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-4">{t('dash_bm_trend')}</p>
            <div className="flex items-end justify-between gap-1.5" style={{ height: 96 }}>
              {trend.map((d) => (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={new Date(d.key + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}>
                  <div className="w-full flex items-end justify-center gap-0.5" style={{ height: 74 }}>
                    <div className="w-1/2 rounded-t bg-[#C9A84C]/70" style={{ height: `${Math.max(2, (d.views / maxTrend) * 70)}px` }} />
                    <div className="w-1/2 rounded-t bg-emerald-500/70" style={{ height: `${Math.max(2, (d.clicks / maxTrend) * 70)}px` }} />
                  </div>
                  <span className="text-[9px] text-zinc-600">{new Date(d.key + 'T12:00:00').getDate()}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C9A84C]/70" />{t('dash_bm_views')}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/70" />{t('dash_bm_product_clicks')}</span>
            </div>
          </div>

          {/* Clics por producto */}
          <div className="rk-card" style={{ padding: '18px 20px' }}>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-zinc-600 mb-4">{t('dash_bm_by_product')}</p>
            {productRows.length === 0 ? (
              <p className="text-sm text-zinc-500">{t('dash_bm_no_products')}</p>
            ) : (
              <div className="space-y-2.5">
                {productRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="text-sm text-white flex-1 truncate">{r.name}</span>
                    <div className="w-32 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(r.n / maxProd) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-emerald-400 w-8 text-right tabular-nums">{r.n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Nota honesta sobre conversión */}
      <div className="rk-card flex items-start gap-3" style={{ padding: 16, borderColor: 'rgba(201,168,76,0.2)' }}>
        <i className="ri-information-line text-[#C9A84C] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-white">{t('dash_bm_conversion_title')}</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">{t('dash_bm_conversion_note')}</p>
        </div>
      </div>
    </div>
  );
}

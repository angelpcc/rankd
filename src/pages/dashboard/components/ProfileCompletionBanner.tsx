import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileCompletion } from '@/hooks/useProfileCompletion';

interface Props {
  completion: ProfileCompletion;
  onComplete: () => void;
  userType?: string;
}

export default function ProfileCompletionBanner({ completion, onComplete, userType = 'fighter' }: Props) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  const isFighter = userType === 'fighter';
  const isBrand = userType === 'brand';

  // Fighters: show until 70% (isReady). Orgs/brands: hide if dismissed or >= 40%
  if (isFighter) {
    if (completion.isReady) return null;
  } else {
    if (dismissed || completion.percent >= 40) return null;
  }

  const topMissing = completion.fields
    .filter((f) => !f.done)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  // ── FIGHTER BANNER — strong, prominent ──────────────────────────────────────
  if (isFighter) {
    return (
      <div className="border border-red-500/40 bg-gradient-to-r from-red-950/40 to-zinc-900 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Icon */}
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/20 flex-shrink-0 text-red-400">
            <i className="ri-alert-line text-xl"></i>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-white">{t('pc_fighter_title')}</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-red-400 bg-red-600/20 border border-red-500/30">
                {t('pc_percent_done', { p: completion.percent })}
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {t('pc_desc_pre')} <strong className="text-red-400">{t('pc_desc_strong')}</strong> {t('pc_desc_post')}
            </p>

            {/* Progress bar */}
            <div className="mt-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full transition-all duration-700"
                    style={{ width: `${completion.percent}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 flex-shrink-0">{completion.percent}/70%</span>
              </div>
            </div>

            {/* Missing fields chips */}
            {topMissing.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-zinc-500">{t('pc_missing')}</span>
                {topMissing.map((f) => (
                  <span key={f.key} className="text-xs bg-zinc-800 border border-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                    {t(f.labelKey)}
                  </span>
                ))}
                {completion.missingCount > 3 && (
                  <span className="text-xs text-zinc-600">+{completion.missingCount - 3} {t('pc_more_suffix')}</span>
                )}
              </div>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={onComplete}
            className="flex-shrink-0 flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-edit-line"></i>
            {t('pc_complete_profile')}
          </button>
        </div>
      </div>
    );
  }

  // ── ORG / BRAND BANNER — soft, dismissible ──────────────────────────────────
  const accentText = isBrand ? 'text-yellow-400' : 'text-zinc-300';
  const barColor = isBrand ? 'bg-yellow-500' : 'bg-zinc-500';

  return (
    <div className="border border-zinc-700/50 bg-zinc-900/60 rounded-xl px-4 py-3 mb-5 flex items-center gap-3 flex-wrap">
      {/* Progress ring / icon */}
      <div className={`w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 flex-shrink-0 ${accentText}`}>
        <i className="ri-user-settings-line text-base"></i>
      </div>

      {/* Text + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-medium text-zinc-300">{t('pc_org_desc')}</p>
          <span className="text-xs text-zinc-500">{completion.percent}%</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden w-full max-w-xs">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-700`}
            style={{ width: `${completion.percent}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onComplete}
          className="text-xs font-medium text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          {t('pc_complete')}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-pointer"
          title={t('pc_close')}
        >
          <i className="ri-close-line text-sm"></i>
        </button>
      </div>
    </div>
  );
}

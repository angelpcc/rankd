import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onUpdate: () => void;
}

const statusConfig = {
  unverified: {
    labelKey: 'vp_status_unverified_label',
    icon: 'ri-shield-line',
    color: 'text-zinc-400',
    bg: 'bg-zinc-800 border-zinc-700',
    descKey: 'vp_status_unverified_desc',
  },
  pending: {
    labelKey: 'vp_status_pending_label',
    icon: 'ri-time-line',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    descKey: 'vp_status_pending_desc',
  },
  verified: {
    labelKey: 'vp_status_verified_label',
    icon: 'ri-shield-check-fill',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
    descKey: 'vp_status_verified_desc',
  },
  rejected: {
    labelKey: 'vp_status_rejected_label',
    icon: 'ri-shield-cross-line',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    descKey: 'vp_status_rejected_desc',
  },
};

const isFighter = (p: Profile) => p.user_type === 'fighter';
const isBrand = (p: Profile) => p.user_type === 'brand';

export default function VerificationPanel({ profile, showToast, onUpdate }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const status = (profile.verification_status || 'unverified') as keyof typeof statusConfig;
  const cfg = statusConfig[status] || statusConfig.unverified;
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);

  const badgeType = isBrand(profile) ? 'brand' : isFighter(profile) ? 'fighter' : 'org';

  const badgePreview = {
    fighter: { icon: 'ri-shield-check-fill', label: t('vp_verified'), color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
    org:     { icon: 'ri-verified-badge-fill', label: t('vp_verified'), color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/30' },
    brand:   { icon: 'ri-vip-crown-fill',      label: t('vp_premium'),    color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  }[badgeType];

  const requestVerification = async () => {
    setSubmitting(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        verification_status: 'pending',
        verification_requested_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (error) {
      showToast(t('vp_toast_error'), 'error');
    } else {
      showToast(t('vp_toast_sent'));
      setShowForm(false);
      onUpdate();
    }
    setSubmitting(false);
  };

  const benefits = isFighter(profile)
    ? [
        { icon: 'ri-shield-check-line', text: t('vp_ben_fighter_1') },
        { icon: 'ri-star-line', text: t('vp_ben_fighter_2') },
        { icon: 'ri-trophy-line', text: t('vp_ben_fighter_3') },
        { icon: 'ri-search-line', text: t('vp_ben_fighter_4') },
      ]
    : isBrand(profile)
    ? [
        { icon: 'ri-vip-crown-line', text: t('vp_ben_brand_1') },
        { icon: 'ri-star-line', text: t('vp_ben_brand_2') },
        { icon: 'ri-hand-coin-line', text: t('vp_ben_brand_3') },
        { icon: 'ri-megaphone-line', text: t('vp_ben_brand_4') },
      ]
    : [
        { icon: 'ri-verified-badge-line', text: t('vp_ben_org_1') },
        { icon: 'ri-trophy-line', text: t('vp_ben_org_2') },
        { icon: 'ri-megaphone-line', text: t('vp_ben_org_3') },
        { icon: 'ri-star-line', text: t('vp_ben_org_4') },
      ];

  const requirements = isFighter(profile)
    ? [
        t('vp_req_fighter_1'),
        t('vp_req_fighter_2'),
        t('vp_req_fighter_3'),
        t('vp_req_fighter_4'),
        t('vp_req_fighter_5'),
      ]
    : [
        t('vp_req_org_1'),
        t('vp_req_org_2'),
        t('vp_req_org_3'),
        t('vp_req_org_4'),
        t('vp_req_org_5'),
      ];

  return (
    <div className="space-y-5">
      {/* Current status card */}
      <div className={`border rounded-2xl p-6 ${cfg.bg}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-900/50 flex-shrink-0 ${cfg.color}`}>
            <i className={`${cfg.icon} text-2xl`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-base font-bold ${cfg.color}`}>{t(cfg.labelKey)}</h3>
              {profile.verified && (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${badgePreview.bg} ${badgePreview.color}`}>
                  <i className={`${badgePreview.icon} text-xs`}></i>
                  {badgePreview.label}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400 mt-1">{t(cfg.descKey)}</p>
            {profile.verification_requested_at && status === 'pending' && (
              <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                <i className="ri-calendar-line"></i>
                {t('vp_requested_on', { date: new Date(profile.verification_requested_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }) })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Badge preview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white mb-3">{t('vp_badge_preview')}</h4>
        <div className="flex items-center gap-4 flex-wrap">
          {/* In profile hero */}
          <div className="flex flex-col items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${profile.verified ? `${badgePreview.bg} ${badgePreview.color}` : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
              <i className={`${profile.verified ? badgePreview.icon : 'ri-shield-line'} text-sm`}></i>
              {profile.verified ? badgePreview.label : t('vp_unverified_short')}
            </div>
            <span className="text-xs text-zinc-600">{t('vp_loc_profile')}</span>
          </div>

          {/* In card */}
          <div className="flex flex-col items-center gap-2">
            <div className={`w-5 h-5 flex items-center justify-center rounded-full ${profile.verified ? badgePreview.color : 'text-zinc-600'}`}>
              <i className={`${profile.verified ? badgePreview.icon : 'ri-shield-line'} text-base`}></i>
            </div>
            <span className="text-xs text-zinc-600">{t('vp_loc_card')}</span>
          </div>

          {/* In candidates */}
          <div className="flex flex-col items-center gap-2">
            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${profile.verified ? `${badgePreview.bg} ${badgePreview.color}` : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
              <i className={`${profile.verified ? badgePreview.icon : 'ri-shield-line'} text-xs`}></i>
              {profile.verified ? badgePreview.label : t('vp_unverified_short')}
            </div>
            <span className="text-xs text-zinc-600">{t('vp_loc_candidates')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Benefits */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className={`${badgePreview.icon} ${badgePreview.color}`}></i>
            {t('vp_benefits_title')}
          </h4>
          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b.text} className="flex items-center gap-3">
                <div className={`w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 flex-shrink-0 ${badgePreview.color}`}>
                  <i className={`${b.icon} text-sm`}></i>
                </div>
                <span className="text-sm text-zinc-300">{b.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Requirements */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ri-file-list-3-line text-zinc-400"></i>
            {t('vp_requirements_title')}
          </h4>
          <ul className="space-y-2.5">
            {requirements.map((r) => (
              <li key={r} className="flex items-start gap-2.5">
                <div className="w-4 h-4 flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 flex-shrink-0 mt-0.5">
                  <i className="ri-check-line text-xs text-zinc-500"></i>
                </div>
                <span className="text-sm text-zinc-400">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA */}
      {status === 'unverified' || status === 'rejected' ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          {!showForm ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-white">
                  {status === 'rejected' ? t('vp_reapply') : t('vp_request')}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t('vp_request_desc')}
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className={`flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                  isBrand(profile)
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-zinc-900'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <i className="ri-send-plane-line"></i>
                {t('vp_request')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white">{t('vp_request_title')}</h4>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  {t('vp_extra_info')} <span className="text-zinc-600">{t('vp_optional')}</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                  placeholder={t('vp_note_ph')}
                />
                <p className="text-xs text-zinc-600 mt-1 text-right">{note.length}/500</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  <i className="ri-information-line mr-1 text-zinc-500"></i>
                  {t('vp_info_note')}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('vp_cancel')}
                </button>
                <button
                  onClick={requestVerification}
                  disabled={submitting}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 ${
                    isBrand(profile)
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-zinc-900'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> {t('vp_sending')}</>
                  ) : (
                    <><i className="ri-send-plane-line"></i> {t('vp_send')}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : status === 'pending' ? (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400 flex-shrink-0">
            <i className="ri-time-line text-xl"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-yellow-400">{t('vp_pending_title')}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{t('vp_pending_desc')}</p>
          </div>
        </div>
      ) : (
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500/10 text-green-400 flex-shrink-0">
            <i className="ri-shield-check-fill text-xl"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-400">{t('vp_verified_title')}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{t('vp_verified_desc')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

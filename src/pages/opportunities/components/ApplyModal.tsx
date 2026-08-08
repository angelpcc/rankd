import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Opportunity } from '@/lib/supabase';

const typeLabelKeys: Record<string, string> = {
  combate: 'opp_type_combate', contrato: 'opp_type_contrato', patrocinio: 'opp_type_patrocinio',
  sparring: 'opp_type_sparring', campamento: 'opp_type_campamento', entrenamiento: 'opp_type_entrenamiento', scouting: 'opp_type_scouting',
};

interface Props {
  opportunity: Opportunity;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

export default function ApplyModal({ opportunity, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(message);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0c0c0c] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl w-full max-w-md overflow-hidden anim-scale-in" style={{ boxShadow: '0 32px 90px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div className="px-6 py-5 flex items-start justify-between border-b border-white/[0.07]" style={{ background: 'linear-gradient(160deg, rgba(225,6,0,0.12) 0%, transparent 70%)' }}>
          <div>
            <p className="text-xs text-zinc-400 mb-1 capitalize">{typeLabelKeys[opportunity.type] ? t(typeLabelKeys[opportunity.type]) : opportunity.type}</p>
            <h2 className="text-base font-bold text-white leading-snug">{opportunity.title}</h2>
            {opportunity.location && (
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                <i className="ri-map-pin-line"></i>{opportunity.location}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer flex-shrink-0 ml-4">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <label className="block text-sm font-semibold text-zinc-200 mb-2">
            {t('op_msg_label')} <span className="text-zinc-500 font-normal">{t('op_optional')}</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder={t('op_msg_ph')}
            style={{ fontSize: 16 }}
            className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 resize-none transition-colors placeholder:text-zinc-500"
          />
          <p className="text-xs text-zinc-500 text-right mt-1">{message.length}/500</p>

          <div className="flex gap-3 mt-5">
            <button
              onClick={onClose}
              style={{ minHeight: 44 }}
              className="flex-1 rounded-xl border border-white/10 text-zinc-300 text-sm font-medium hover:border-white/25 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('op_cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ minHeight: 44 }}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('op_sending')}</>
                : <><i className="ri-send-plane-line"></i> {t('op_send_application')}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

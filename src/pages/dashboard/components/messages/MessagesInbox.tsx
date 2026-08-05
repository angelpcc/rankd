import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Conversation } from '@/hooks/useMessages';

const userTypeLabelKeys: Record<string, string> = {
  fighter: 'msg_type_fighter',
  promoter: 'msg_type_promoter',
  gym: 'msg_type_gym',
  manager: 'msg_type_manager',
  brand: 'msg_type_brand',
};

const userTypeColors: Record<string, string> = {
  fighter: 'bg-red-500/10 text-red-400',
  promoter: 'bg-orange-500/10 text-orange-400',
  gym: 'bg-emerald-500/10 text-emerald-400',
  manager: 'bg-zinc-700 text-zinc-300',
  brand: 'bg-yellow-500/10 text-yellow-400',
};

function formatTime(dateStr: string, t: TFunction, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return t('msg_yesterday');
  } else if (diffDays < 7) {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  }
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

interface Props {
  conversations: Conversation[];
  activeConvoId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  currentUserId: string;
}

export default function MessagesInbox({ conversations, activeConvoId, loading, onSelect, currentUserId }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
        <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500 mb-4">
          <i className="ri-message-3-line text-3xl"></i>
        </div>
        <p className="text-sm font-semibold text-zinc-300">{t('msg_empty_title')}</p>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          {t('msg_empty_desc')}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-800/60">
      {conversations.map((convo) => {
        const other = convo.other_user;
        const initials = (other.full_name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
        const isActive = convo.id === activeConvoId;
        const typeColor = userTypeColors[other.user_type] || 'bg-zinc-700 text-zinc-300';
        const typeLabel = userTypeLabelKeys[other.user_type] ? t(userTypeLabelKeys[other.user_type]) : other.user_type;

        return (
          <button
            key={convo.id}
            onClick={() => onSelect(convo.id)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer ${isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0 relative">
              {other.avatar_url ? (
                <img
                  src={other.avatar_url}
                  alt={other.full_name || ''}
                  className="w-11 h-11 rounded-full object-cover object-top"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center text-white text-sm font-bold">
                  {initials}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white truncate">{other.full_name || t('msg_user_fallback')}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  {convo.unread_count > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-600 text-white text-[10px] font-bold rounded-full">
                      {convo.unread_count > 9 ? '9+' : convo.unread_count}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">{formatTime(convo.last_message_at, t, locale)}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColor}`}>
                  {typeLabel}
                </span>
                {convo.last_message && (
                  <p className={`text-xs truncate ${convo.unread_count > 0 ? 'text-white font-semibold' : 'text-zinc-500'}`}>{convo.last_message}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
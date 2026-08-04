import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface Props {
  profileId: string;
  fullName: string;
  onBack: () => void;
  onFinish: () => void;
  saving: boolean;
  error: string;
}

export default function OnboardingStep4({ profileId, fullName, onBack, onFinish, saving, error }: Props) {
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (fullName || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError(t('onb_f_err_size')); return; }
    if (!file.type.startsWith('image/')) { setUploadError(t('onb_f_err_type')); return; }

    setUploading(true);
    setUploadError('');

    const ext = file.name.split('.').pop();
    const path = `avatars/${profileId}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { setUploadError(t('onb_f_err_upload')); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profileId);
    setAvatarUrl(publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-2xl font-black text-white">{t('onb_f_s4_title')}</h2>
        <p className="text-zinc-400 text-sm mt-1">{t('onb_f_s4_sub')}</p>
      </div>

      {/* Avatar upload area */}
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-32 h-32 rounded-2xl object-cover object-top border-2 border-red-500/40"
            />
          ) : (
            <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white text-4xl font-black border-2 border-red-500/20">
              {initials}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-2 -right-2 w-9 h-9 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-full border-2 border-zinc-950 cursor-pointer transition-colors"
          >
            <i className="ri-camera-line text-white text-sm"></i>
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

        <div className="text-center">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300 cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <i className="ri-upload-cloud-line"></i>
            {avatarUrl ? t('onb_f_change_photo') : t('onb_f_upload_photo')}
          </button>
          <p className="text-xs text-zinc-600 mt-1">{t('onb_file_hint')}</p>
        </div>

        {uploadError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{uploadError}</p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <i className="ri-check-double-line text-green-400"></i>
          {t('onb_f_almost')}
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {t('onb_f_almost_desc')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['onb_f_chip_basic', 'onb_f_chip_sport', 'onb_f_chip_social'].map((chipKey) => (
            <span key={chipKey} className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
              <i className="ri-check-line text-xs"></i>
              {t(chipKey)}
            </span>
          ))}
          {avatarUrl && (
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
              <i className="ri-check-line text-xs"></i>
              {t('onb_f_chip_photo')}
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line mr-1"></i>
          {t('onb_back')}
        </button>
        <button
          onClick={onFinish}
          disabled={saving}
          className="flex-[2] bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('onb_saving')}</>
          ) : (
            <><i className="ri-rocket-line"></i> {t('onb_go_dashboard')}</>
          )}
        </button>
      </div>
    </div>
  );
}

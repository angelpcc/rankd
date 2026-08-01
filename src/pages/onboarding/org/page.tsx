import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const orgTypeConfig: Record<string, { labelKey: string; icon: string; color: string; dashPath: string }> = {
  promoter: { labelKey: 'onb_type_promoter', icon: 'ri-trophy-line', color: 'text-red-400', dashPath: '/dashboard/org' },
  gym:      { labelKey: 'onb_type_gym', icon: 'ri-building-4-line', color: 'text-emerald-400', dashPath: '/dashboard/org' },
  manager:  { labelKey: 'onb_type_manager', icon: 'ri-user-star-line', color: 'text-zinc-300', dashPath: '/dashboard/org' },
  brand:    { labelKey: 'onb_type_brand', icon: 'ri-store-2-line', color: 'text-yellow-400', dashPath: '/dashboard/brand' },
};

const STEPS = [
  { id: 1, labelKey: 'onb_org_step1', icon: 'ri-building-line' },
  { id: 2, labelKey: 'onb_org_step2', icon: 'ri-links-line' },
  { id: 3, labelKey: 'onb_org_step3', icon: 'ri-image-line' },
];

export default function OrgOnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const userType = profile?.user_type || 'promoter';
  const cfg = orgTypeConfig[userType] || orgTypeConfig.promoter;
  const typeLabel = t(cfg.labelKey);
  const typeLow = typeLabel.toLowerCase();

  // Form state
  const [orgName, setOrgName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');

  const initials = (orgName || profile?.full_name || 'O').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `avatars/${profile.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id);
      setAvatarUrl(urlData.publicUrl);
    }
    setUploading(false);
  };

  const saveAndFinish = async () => {
    if (!user || !profile) return;
    setSaving(true);
    setError('');
    try {
      // supabase no lanza excepción: sin mirar el error, el usuario termina
      // el alta y aterriza en un panel vacío creyendo que se guardó.
      const { error: profileError } = await supabase.from('profiles').update({
        bio: description.trim(),
        location: location.trim(),
        website: website.trim(),
        instagram: instagram.trim(),
        twitter: twitter.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (profileError) throw profileError;

      const orgPayload = {
        profile_id: profile.id,
        org_name: orgName.trim() || profile.full_name || '',
        org_type: userType,
        description: description.trim(),
        founded_year: foundedYear ? parseInt(foundedYear, 10) : null,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase.from('organizations').select('id').eq('profile_id', profile.id).maybeSingle();
      const { error: orgError } = existing
        ? await supabase.from('organizations').update(orgPayload).eq('id', existing.id)
        : await supabase.from('organizations').insert(orgPayload);
      if (orgError) throw orgError;

      // For brand users, also create/update the brands table entry
      if (userType === 'brand') {
        const brandPayload = {
          user_id: profile.id,
          name: orgName.trim() || profile.full_name || 'Marca sin nombre',
          email: user.email || '',
          description: description.trim() || '',
          website: website.trim() || null,
          status: 'pending',
          is_public: false,
          type: 'both',
          updated_at: new Date().toISOString(),
        };

        const { data: existingBrand } = await supabase
          .from('brands')
          .select('id')
          .eq('user_id', profile.id)
          .maybeSingle();

        const { error: brandError } = existingBrand
          ? await supabase.from('brands').update(brandPayload).eq('id', existingBrand.id)
          : await supabase.from('brands').insert(brandPayload);
        if (brandError) throw brandError;
      }

      navigate(cfg.dashPath);
    } catch {
      setError(t('error_save'));
    } finally {
      setSaving(false);
    }
  };

  const progressPct = Math.round(((step - 1) / STEPS.length) * 100 + 100 / STEPS.length);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-0 cursor-pointer py-2">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
          <button onClick={() => navigate(cfg.dashPath)} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors whitespace-nowrap">
            {t('onb_finish_later')}
          </button>
        </div>
        <div className="h-1 bg-zinc-800">
          <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full px-6 pt-8 pb-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 flex items-center justify-center rounded-full border-2 transition-all ${done ? 'bg-red-600 border-red-600' : active ? 'border-red-500 bg-red-500/10' : 'border-zinc-700 bg-zinc-900'}`}>
                    {done ? <i className="ri-check-line text-white text-sm"></i> : <i className={`${s.icon} text-sm ${active ? 'text-red-400' : 'text-zinc-600'}`}></i>}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${active ? 'text-white' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>{t(s.labelKey)}</span>
                </div>
                {idx < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 transition-colors ${done ? 'bg-red-600' : 'bg-zinc-800'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 pb-12">

        {/* Step 1 — Org info */}
        {step === 1 && (
          <div className="space-y-6 pt-2">
            <div>
              <div className={`inline-flex items-center gap-2 text-sm font-semibold mb-2 ${cfg.color}`}>
                <i className={cfg.icon}></i>
                {typeLabel}
              </div>
              <h2 className="text-2xl font-black text-white">{t('onb_org_s1_title', { type: typeLow })}</h2>
              <p className="text-zinc-400 text-sm mt-1">{t('onb_org_s1_sub')}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  {t('onb_org_name_label', { type: typeLow })} <span className="text-red-500">*</span>
                </label>
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
                  placeholder={t('onb_org_name_ph', { type: typeLow })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_desc')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={500}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600 resize-none"
                  placeholder={t('onb_org_desc_ph', { type: typeLow })}
                />
                <p className="text-xs text-zinc-600 mt-1 text-right">{description.length}/500</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_location')}</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
                    placeholder="Madrid, España"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('onb_founded')}</label>
                  <input
                    type="number"
                    value={foundedYear}
                    onChange={(e) => setFoundedYear(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
                    placeholder="2015"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!orgName.trim()}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              {t('onb_continue')} <i className="ri-arrow-right-line"></i>
            </button>
          </div>
        )}

        {/* Step 2 — Contact & social */}
        {step === 2 && (
          <div className="space-y-6 pt-2">
            <div>
              <h2 className="text-2xl font-black text-white">{t('onb_org_s2_title')}</h2>
              <p className="text-zinc-400 text-sm mt-1">{t('onb_org_s2_sub')}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  <i className="ri-global-line mr-1.5 text-zinc-400"></i>{t('onb_website')}
                </label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 placeholder-zinc-600"
                  placeholder="https://tuorganizacion.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  <i className="ri-instagram-line mr-1.5 text-pink-400"></i>Instagram
                </label>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-pink-500 placeholder-zinc-600"
                  placeholder="@tuorganizacion"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  <i className="ri-twitter-x-line mr-1.5 text-zinc-400"></i>Twitter / X
                </label>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
                  placeholder="@tuorganizacion"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-arrow-left-line mr-1"></i>{t('onb_back')}
              </button>
              <button onClick={() => setStep(3)} className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                {t('onb_continue')} <i className="ri-arrow-right-line"></i>
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Logo/avatar */}
        {step === 3 && (
          <div className="space-y-6 pt-2">
            <div>
              <h2 className="text-2xl font-black text-white">{t('onb_org_s3_title')}</h2>
              <p className="text-zinc-400 text-sm mt-1">{t('onb_org_s3_sub', { type: typeLow })}</p>
            </div>

            <div className="flex flex-col items-center gap-5 py-6">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={orgName} className="w-32 h-32 rounded-2xl object-cover object-top border-2 border-red-500/40" />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white text-4xl font-black border-2 border-zinc-700">
                    {initials}
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <button onClick={() => fileRef.current?.click()} className="absolute -bottom-2 -right-2 w-9 h-9 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-full border-2 border-zinc-950 cursor-pointer transition-colors">
                  <i className="ri-camera-line text-white text-sm"></i>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300 cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap">
                <i className="ri-upload-cloud-line"></i>
                {avatarUrl ? t('onb_change_logo') : t('onb_upload_logo')}
              </button>
              <p className="text-xs text-zinc-600">{t('onb_file_hint')}</p>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-arrow-left-line mr-1"></i>{t('onb_back')}
              </button>
              <button onClick={saveAndFinish} disabled={saving} className="flex-[2] bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('onb_saving')}</> : <><i className="ri-rocket-line"></i> {t('onb_go_dashboard')}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

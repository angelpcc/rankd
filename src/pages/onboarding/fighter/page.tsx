import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import OnboardingStep1 from './components/OnboardingStep1';
import OnboardingStep2 from './components/OnboardingStep2';
import OnboardingStep3 from './components/OnboardingStep3';
import OnboardingStep4 from './components/OnboardingStep4';

export interface FighterOnboardingData {
  // Step 1 — Identity
  full_name: string;
  nickname: string;
  bio: string;
  location: string;
  nationality: string;
  age: string;
  // Step 2 — Sport
  discipline: string;
  weight_class: string;
  experience_level: string;
  gym: string;
  coach: string;
  wins: string;
  losses: string;
  draws: string;
  kos: string;
  looking_for: string[];
  // Step 3 — Media
  highlight_video: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  twitter: string;
  // Step 4 — Avatar (handled separately)
}

const STEPS = [
  { id: 1, labelKey: 'onb_f_step1', icon: 'ri-user-line' },
  { id: 2, labelKey: 'onb_f_step2', icon: 'ri-boxing-line' },
  { id: 3, labelKey: 'onb_f_step3', icon: 'ri-instagram-line' },
  { id: 4, labelKey: 'onb_f_step4', icon: 'ri-camera-line' },
];

const initialData: FighterOnboardingData = {
  full_name: '', nickname: '', bio: '', location: '', nationality: '', age: '',
  discipline: '', weight_class: '', experience_level: 'amateur',
  gym: '', coach: '', wins: '0', losses: '0', draws: '0', kos: '0',
  looking_for: [],
  highlight_video: '', instagram: '', tiktok: '', youtube: '', twitter: '',
};

export default function FighterOnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FighterOnboardingData>({
    ...initialData,
    full_name: profile?.full_name || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = useCallback((partial: Partial<FighterOnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveAndFinish = async () => {
    if (!user || !profile) return;
    setSaving(true);
    setError('');

    try {
      // Update profile
      // (supabase no lanza excepción: si no miramos el error, el usuario
      //  termina el alta y aterriza en un panel vacío creyendo que guardó)
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: data.full_name.trim(),
        bio: data.bio.trim(),
        location: data.location.trim(),
        instagram: data.instagram.trim(),
        tiktok: data.tiktok.trim(),
        youtube: data.youtube.trim(),
        twitter: data.twitter.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (profileError) throw profileError;

      // Upsert fighter record
      const { data: existingFighter } = await supabase
        .from('fighters')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      const fighterPayload = {
        profile_id: profile.id,
        nickname: data.nickname.trim(),
        discipline: data.discipline || null,
        weight_class: data.weight_class || null,
        age: data.age ? parseInt(data.age, 10) : null,
        nationality: data.nationality.trim(),
        wins: parseInt(data.wins, 10) || 0,
        losses: parseInt(data.losses, 10) || 0,
        draws: parseInt(data.draws, 10) || 0,
        kos: parseInt(data.kos, 10) || 0,
        experience_level: data.experience_level || 'amateur',
        gym: data.gym.trim(),
        coach: data.coach.trim(),
        looking_for: data.looking_for,
        highlight_video: data.highlight_video.trim(),
        is_available: true,
        is_public: true,
        updated_at: new Date().toISOString(),
      };

      const { error: fighterError } = existingFighter
        ? await supabase.from('fighters').update(fighterPayload).eq('id', existingFighter.id)
        : await supabase.from('fighters').insert(fighterPayload);
      if (fighterError) throw fighterError;

      navigate('/dashboard/fighter');
    } catch {
      setError(t('error_save'));
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = STEPS.length;
  const progressPct = Math.round(((step - 1) / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-0 cursor-pointer py-2">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
          <button
            onClick={() => navigate('/dashboard/fighter')}
            className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors whitespace-nowrap"
          >
            {t('onb_finish_later')}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-zinc-800">
          <div
            className="h-full bg-red-600 transition-all duration-500"
            style={{ width: `${progressPct + (100 / totalSteps)}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-8 pb-3 sm:pb-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full border-2 transition-all ${done ? 'bg-red-600 border-red-600' : active ? 'border-red-500 bg-red-500/10' : 'border-zinc-700 bg-zinc-900'}`}>
                    {done ? (
                      <i className="ri-check-line text-white text-xs sm:text-sm"></i>
                    ) : (
                      <i className={`${s.icon} text-xs sm:text-sm ${active ? 'text-red-400' : 'text-zinc-600'}`}></i>
                    )}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-medium ${active ? 'text-white' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {t(s.labelKey)}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 sm:mx-3 transition-colors ${done ? 'bg-red-600' : 'bg-zinc-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 pb-10 sm:pb-12">
        {step === 1 && (
          <OnboardingStep1
            data={data}
            onUpdate={update}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <OnboardingStep2
            data={data}
            onUpdate={update}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <OnboardingStep3
            data={data}
            onUpdate={update}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <OnboardingStep4
            profileId={profile?.id || ''}
            fullName={data.full_name}
            onBack={() => setStep(3)}
            onFinish={saveAndFinish}
            saving={saving}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

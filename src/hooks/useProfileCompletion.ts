import { Profile, Fighter } from '@/lib/supabase';

export interface CompletionField {
  key: string;
  labelKey: string;
  done: boolean;
  weight: number;
}

export interface ProfileCompletion {
  percent: number;
  fields: CompletionField[];
  isReady: boolean; // >= 70%
  missingCount: number;
}

export function useFighterCompletion(profile: Profile | null, fighter: Fighter | null): ProfileCompletion {
  const fields: CompletionField[] = [
    { key: 'avatar', labelKey: 'pc_field_photo', done: !!profile?.avatar_url, weight: 10 },
    { key: 'full_name', labelKey: 'pc_field_full_name', done: !!(profile?.full_name?.trim()), weight: 10 },
    { key: 'bio', labelKey: 'pc_field_bio', done: !!(profile?.bio?.trim()), weight: 8 },
    { key: 'location', labelKey: 'pc_field_location', done: !!(profile?.location?.trim()), weight: 6 },
    { key: 'discipline', labelKey: 'pc_field_discipline', done: !!(fighter?.discipline), weight: 10 },
    { key: 'weight_class', labelKey: 'pc_field_weight', done: !!(fighter?.weight_class), weight: 8 },
    { key: 'experience_level', labelKey: 'pc_field_experience', done: !!(fighter?.experience_level), weight: 8 },
    { key: 'nickname', labelKey: 'pc_field_nickname', done: !!(fighter?.nickname?.trim()), weight: 4 },
    { key: 'record', labelKey: 'pc_field_record', done: !!(fighter && (fighter.wins > 0 || fighter.losses > 0 || fighter.draws > 0)), weight: 8 },
    { key: 'gym', labelKey: 'pc_field_gym', done: !!(fighter?.gym?.trim()), weight: 6 },
    { key: 'highlight_video', labelKey: 'pc_field_video', done: !!(fighter?.highlight_video?.trim()), weight: 8 },
    { key: 'social', labelKey: 'pc_field_social', done: !!(profile?.instagram || profile?.tiktok || profile?.youtube || profile?.twitter), weight: 8 },
    { key: 'looking_for', labelKey: 'pc_field_looking_for', done: !!(fighter?.looking_for && fighter.looking_for.length > 0), weight: 6 },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  const doneWeight = fields.filter((f) => f.done).reduce((sum, f) => sum + f.weight, 0);
  const percent = Math.round((doneWeight / totalWeight) * 100);

  return {
    percent,
    fields,
    isReady: percent >= 70,
    missingCount: fields.filter((f) => !f.done).length,
  };
}

export function useOrgCompletion(profile: Profile | null, orgName?: string, description?: string): ProfileCompletion {
  const fields: CompletionField[] = [
    { key: 'full_name', labelKey: 'pc_field_contact_name', done: !!(profile?.full_name?.trim()), weight: 10 },
    { key: 'org_name', labelKey: 'pc_field_org_name', done: !!(orgName?.trim()), weight: 15 },
    { key: 'bio', labelKey: 'pc_field_description', done: !!(description?.trim() || profile?.bio?.trim()), weight: 15 },
    { key: 'location', labelKey: 'pc_field_location', done: !!(profile?.location?.trim()), weight: 10 },
    { key: 'website', labelKey: 'pc_field_website', done: !!(profile?.website?.trim()), weight: 10 },
    { key: 'instagram', labelKey: 'pc_field_social', done: !!(profile?.instagram || profile?.twitter), weight: 10 },
    { key: 'avatar', labelKey: 'pc_field_logo', done: !!(profile?.avatar_url), weight: 15 },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  const doneWeight = fields.filter((f) => f.done).reduce((sum, f) => sum + f.weight, 0);
  const percent = Math.round((doneWeight / totalWeight) * 100);

  return {
    percent,
    fields,
    isReady: percent >= 60,
    missingCount: fields.filter((f) => !f.done).length,
  };
}

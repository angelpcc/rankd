import { Profile, Fighter } from '@/lib/supabase';

export interface CompletionField {
  key: string;
  label: string;
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
    { key: 'avatar', label: 'Foto de perfil', done: !!profile?.avatar_url, weight: 10 },
    { key: 'full_name', label: 'Nombre completo', done: !!(profile?.full_name?.trim()), weight: 10 },
    { key: 'bio', label: 'Biografía', done: !!(profile?.bio?.trim()), weight: 8 },
    { key: 'location', label: 'Ubicación', done: !!(profile?.location?.trim()), weight: 6 },
    { key: 'discipline', label: 'Disciplina', done: !!(fighter?.discipline), weight: 10 },
    { key: 'weight_class', label: 'Categoría de peso', done: !!(fighter?.weight_class), weight: 8 },
    { key: 'experience_level', label: 'Nivel de experiencia', done: !!(fighter?.experience_level), weight: 8 },
    { key: 'nickname', label: 'Apodo', done: !!(fighter?.nickname?.trim()), weight: 4 },
    { key: 'record', label: 'Récord deportivo', done: !!(fighter && (fighter.wins > 0 || fighter.losses > 0 || fighter.draws > 0)), weight: 8 },
    { key: 'gym', label: 'Gimnasio', done: !!(fighter?.gym?.trim()), weight: 6 },
    { key: 'highlight_video', label: 'Vídeo destacado', done: !!(fighter?.highlight_video?.trim()), weight: 8 },
    { key: 'social', label: 'Redes sociales', done: !!(profile?.instagram || profile?.tiktok || profile?.youtube || profile?.twitter), weight: 8 },
    { key: 'looking_for', label: 'Qué busca', done: !!(fighter?.looking_for && fighter.looking_for.length > 0), weight: 6 },
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
    { key: 'full_name', label: 'Nombre de contacto', done: !!(profile?.full_name?.trim()), weight: 10 },
    { key: 'org_name', label: 'Nombre de la organización', done: !!(orgName?.trim()), weight: 15 },
    { key: 'bio', label: 'Descripción', done: !!(description?.trim() || profile?.bio?.trim()), weight: 15 },
    { key: 'location', label: 'Ubicación', done: !!(profile?.location?.trim()), weight: 10 },
    { key: 'website', label: 'Sitio web', done: !!(profile?.website?.trim()), weight: 10 },
    { key: 'instagram', label: 'Redes sociales', done: !!(profile?.instagram || profile?.twitter), weight: 10 },
    { key: 'avatar', label: 'Logo / Foto', done: !!(profile?.avatar_url), weight: 15 },
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

// CRUD de content_generated + versionado, compartido por las 3 secciones de
// Creator Studio (vídeos, publicaciones, mensajes). RLS ya restringe estas
// tablas a rk_is_admin() (migración 0028), así que aquí no hay que repetir
// el filtro por usuario: si la query pasa, es porque es admin.
import { supabase } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

export type ContentType = 'video' | 'publication' | 'message';
export type ContentStatus = 'draft' | 'ready' | 'published' | 'archived';

export interface ContentRow<T = unknown> {
  id: string;
  creator_id: string;
  type: ContentType;
  subtype: string | null;
  title: string;
  user_prompt: string;
  generated_content: T;
  status: ContentStatus;
  tokens_used: number | null;
  model_used: string | null;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 10;

export async function listContent<T = unknown>(
  type: ContentType,
  opts: { search?: string; status?: ContentStatus | 'all'; page?: number } = {},
): Promise<{ rows: ContentRow<T>[]; total: number; unavailable: boolean }> {
  const page = opts.page ?? 0;
  let query = supabase.from('content_generated').select('*', { count: 'exact' }).eq('type', type);
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  if (opts.search?.trim()) query = query.ilike('title', `%${opts.search.trim()}%`);
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (isMissingTable(error)) return { rows: [], total: 0, unavailable: true };
  return { rows: (data || []) as ContentRow<T>[], total: count || 0, unavailable: false };
}

export async function createContent<T>(
  type: ContentType, subtype: string, title: string, userPrompt: string, content: T,
): Promise<ContentRow<T> | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('content_generated').insert({
    creator_id: user.id, type, subtype, title: title.slice(0, 140),
    user_prompt: userPrompt.slice(0, 2000), generated_content: content, status: 'draft',
  }).select().maybeSingle();
  if (error || !data) return null;
  return data as ContentRow<T>;
}

/** Guarda una edición: sube versión y deja constancia de la versión anterior. */
export async function updateContent<T>(
  row: ContentRow<T>, patch: Partial<Pick<ContentRow<T>, 'title' | 'generated_content' | 'status' | 'tags'>>,
): Promise<ContentRow<T> | null> {
  await supabase.from('content_versions').insert({
    content_id: row.id, version: row.version, generated_content: row.generated_content,
  });
  const { data, error } = await supabase.from('content_generated')
    .update({ ...patch, version: row.version + 1, updated_at: new Date().toISOString() })
    .eq('id', row.id).select().maybeSingle();
  if (error || !data) return null;
  return data as ContentRow<T>;
}

export async function deleteContent(id: string): Promise<boolean> {
  const { error } = await supabase.from('content_generated').delete().eq('id', id);
  return !error;
}

export { PAGE_SIZE };

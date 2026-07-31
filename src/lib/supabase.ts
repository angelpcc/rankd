import { createClient } from '@supabase/supabase-js';
import { isViewingAs, notifyBlocked } from '@/lib/viewAs';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

const client = createClient(supabaseUrl, supabaseAnonKey);

// ════════════════════════════════════════════════════════════════
// GUARDIÁN DE ESCRITURAS DEL MODO "VER COMO"
//
// Mientras el administrador revisa la plataforma con la piel de otro perfil,
// TODA escritura queda bloqueada aquí, en un único sitio. Es defensa en
// profundidad: aunque se nos olvide desactivar un botón concreto en alguna
// pantalla, la operación no sale del navegador.
//
// (Por debajo, RLS ya lo impediría: el JWT sigue siendo el del admin y las
// políticas comparan auth.uid() con el dueño de la fila. Esto evita además
// que se escriba por accidente en los datos del PROPIO admin.)
// ════════════════════════════════════════════════════════════════

const MUTATIONS = new Set(['insert', 'update', 'upsert', 'delete']);

/**
 * Resultado encadenable que imita a un query builder pero nunca llega a la red.
 * Devuelve { error } para que el código existente entre por su rama de error
 * en vez de romperse, y avisa a la barra para explicar por qué.
 */
function blockedResult(action: string): unknown {
  notifyBlocked(action);
  const result = { data: null, error: { message: 'view_mode', code: 'view_mode', details: '', hint: '' } };
  const chain: Record<string, unknown> = {
    then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => Promise.resolve(result).then(onOk, onErr),
    catch: (fn: (e: unknown) => unknown) => Promise.resolve(result).catch(fn),
    finally: (fn: () => void) => Promise.resolve(result).finally(fn),
  };
  // Cualquier otro método encadenado (.select(), .eq(), .maybeSingle()...)
  // devuelve la misma cadena, de modo que await siempre acaba en `result`.
  return new Proxy(chain, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      return () => chain;
    },
  });
}

const rawFrom = client.from.bind(client);
type FromFn = typeof client.from;

(client as { from: FromFn }).from = ((table: string) => {
  const qb = rawFrom(table as never);
  if (!isViewingAs()) return qb;
  return new Proxy(qb as object, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && MUTATIONS.has(prop)) {
        return () => blockedResult(`${prop}:${table}`);
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}) as FromFn;

// Subidas de ficheros y llamadas RPC: mismo bloqueo.
const rawStorageFrom = client.storage.from.bind(client.storage);
type StorageFromFn = typeof client.storage.from;
(client.storage as { from: StorageFromFn }).from = ((bucket: string) => {
  const sb = rawStorageFrom(bucket);
  if (!isViewingAs()) return sb;
  return new Proxy(sb as object, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && ['upload', 'remove', 'update', 'move', 'copy'].includes(prop)) {
        return async () => { notifyBlocked(`storage:${prop}`); return { data: null, error: { message: 'view_mode' } }; };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}) as StorageFromFn;

const rawRpc = client.rpc.bind(client);
type RpcFn = typeof client.rpc;
(client as { rpc: RpcFn }).rpc = ((fn: string, args?: unknown, opts?: unknown) => {
  if (isViewingAs()) return blockedResult(`rpc:${fn}`) as ReturnType<RpcFn>;
  return rawRpc(fn as never, args as never, opts as never);
}) as RpcFn;

export const supabase = client;

export type UserType = 'fighter' | 'promoter' | 'manager' | 'brand' | 'gym' | 'coach';

export interface Profile {
  id: string;
  user_type: UserType;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  twitter: string | null;
  youtube: string | null;
  verified: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verification_requested_at: string | null;
  country?: string | null;
  athlete_mode?: 'competitor' | 'hobby' | null;
  created_at: string;
  updated_at: string;
}

export interface Fighter {
  id: string;
  profile_id: string;
  nickname: string | null;
  discipline: string | null;
  weight_class: string | null;
  age: number | null;
  nationality: string | null;
  wins: number;
  losses: number;
  draws: number;
  kos: number;
  experience_level: string | null;
  gym: string | null;
  coach: string | null;
  looking_for: string[] | null;
  highlight_video: string | null;
  profile_views: number;
  is_available: boolean;
  is_public: boolean;
  rating: number;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  profile_id: string;
  org_name: string;
  org_type: string | null;
  description: string | null;
  logo_url: string | null;
  founded_year: number | null;
  events_organized: number;
  fighters_managed: number;
  verified: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface FighterVideo {
  id: string;
  fighter_id: string;
  title: string;
  url: string;
  thumbnail_url: string | null;
  video_type: string | null;
  created_at: string;
}

export interface FighterAchievement {
  id: string;
  fighter_id: string;
  title: string;
  year: number | null;
  description: string | null;
  created_at: string;
}

export type OpportunityType = 'combate' | 'contrato' | 'patrocinio' | 'sparring' | 'campamento' | 'entrenamiento' | 'scouting';
export type OpportunityStatus = 'open' | 'closed';

export interface Opportunity {
  id: string;
  profile_id: string;
  title: string;
  type: OpportunityType;
  discipline: string | null;
  weight_class: string | null;
  experience_level: string | null;
  location: string | null;
  event_date: string | null;
  description: string | null;
  status: OpportunityStatus;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  opportunity_id: string;
  fighter_profile_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Brand {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  website: string | null;
  category: string | null;
  description: string;
  logo_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_public: boolean;
  type: 'product' | 'service' | 'both';
  created_at: string;
  updated_at: string;
}

export interface BrandService {
  id: string;
  user_id: string;
  brand_profile_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  price: string | null;
  modality: 'online' | 'presencial' | 'ambos';
  location: string | null;
  contact_link: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandProduct {
  id: string;
  user_id: string;
  brand_profile_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: string | null;
  image_url: string | null;
  external_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgGalleryImage {
  id: string;
  user_id: string;
  org_profile_id: string;
  image_url: string;
  caption: string | null;
  category: string | null;
  created_at: string;
}

export interface OrgEvent {
  id: string;
  user_id: string;
  org_profile_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  event_date: string | null;
  location: string | null;
  external_link: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ── Espacio de entrenador (R13-T1) ──
export interface GymStaff {
  id: string;
  org_profile_id: string;
  coach_profile_id: string;
  role: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface GymInvitation {
  id: string;
  org_profile_id: string;
  code: string;
  email: string | null;
  invited_name: string | null;
  role: string;
  status: 'pending' | 'accepted' | 'revoked';
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface GymRosterEntry {
  id: string;
  org_profile_id: string;
  fighter_profile_id: string | null;
  display_name: string;
  note: string | null;
  status: 'active' | 'left';
  shares_activity: boolean;
  created_at: string;
}

export interface ClubSession {
  id: string;
  org_profile_id: string;
  coach_profile_id: string | null;
  session_date: string;
  part_of_day: 'morning' | 'afternoon' | 'evening';
  session_type: string;
  title: string;
  group_label: string | null;
  notes: string | null;
  created_at: string;
}

// Interfaces for Supabase tables
export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  role: string | null;
  discipline: string | null;
  message: string;
  created_at: string;
}

export interface FighterInquiry {
  id: string;
  fighter_id: string;
  fighter_name: string | null;
  contact_name: string;
  email: string;
  organization: string | null;
  interest_type: string | null;
  message: string;
  created_at: string;
}
export interface EventTicket {
  id: string;
  event_id: string;
  org_profile_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  quantity_total: number;
  quantity_sold: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface TicketOrder {
  id: string;
  ticket_id: string;
  event_id: string;
  org_profile_id: string;
  buyer_user_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
}

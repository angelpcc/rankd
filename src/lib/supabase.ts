import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserType = 'fighter' | 'promoter' | 'manager' | 'brand' | 'gym';

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
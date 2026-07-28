import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import { getViewAs, VIEW_AS_EVENT, type ViewAsState } from '@/lib/viewAs';
import { isAdminEmail } from '@/lib/admin';
import { trackVisit } from '@/lib/trackVisit';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
}

/** Perfil sintético para revisar la interfaz sin tocar ningún dato real. */
function syntheticProfile(view: ViewAsState, base: Profile | null): Profile {
  return {
    ...(base as Profile),
    id: view.profileId || base?.id || 'view-as',
    user_type: (view.userType || 'fighter') as Profile['user_type'],
    athlete_mode: view.athleteMode,
    full_name: view.label,
    avatar_url: view.avatarUrl ?? null,
    verified: base?.verified ?? false,
    verification_status: base?.verification_status ?? 'unverified',
  };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  });
  // Se re-renderiza al entrar o salir del modo "ver como"
  const [view, setView] = useState<ViewAsState | null>(() => getViewAs());

  useEffect(() => {
    const sync = () => setView(getViewAs());
    window.addEventListener(VIEW_AS_EVENT, sync);
    return () => window.removeEventListener(VIEW_AS_EVENT, sync);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({ ...prev, session, user: session?.user ?? null }));
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({ ...prev, session, user: session?.user ?? null }));
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, profile: null, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, retries = 3) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!data && retries > 0) {
      // Profile might not exist yet (trigger delay) — retry after a short wait
      await new Promise((res) => setTimeout(res, 1200));
      return fetchProfile(userId, retries - 1);
    }

    setState(prev => ({ ...prev, profile: data, loading: false }));

    // Deja constancia de que ha entrado hoy. Es lo que permite medir después
    // cuánta gente vuelve, que es la métrica que de verdad importa.
    if (data) trackVisit();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // ── Superposición del modo "ver como" ──
  // Solo se aplica si quien está detrás es de verdad un administrador: si no,
  // un sessionStorage manipulado a mano no cambiaría absolutamente nada.
  const realIsAdmin = isAdminEmail(state.user?.email);
  const viewingAs = !!view && realIsAdmin && !state.loading;

  if (viewingAs && view) {
    // Visitante sin cuenta: se devuelve sesión vacía para ver la plataforma
    // exactamente como la ve alguien que no se ha registrado.
    if (view.userType === null) {
      return {
        user: null,
        session: null,
        profile: null,
        loading: false,
        signOut,
        refetchProfile: () => {},
        isViewingAs: true,
        viewAs: view,
        realUser: state.user,
        realProfile: state.profile,
      };
    }
    return {
      ...state,
      profile: syntheticProfile(view, state.profile),
      signOut,
      refetchProfile: () => {},
      isViewingAs: true,
      viewAs: view,
      realUser: state.user,
      realProfile: state.profile,
    };
  }

  return {
    ...state,
    signOut,
    refetchProfile: () => state.user && fetchProfile(state.user.id),
    isViewingAs: false,
    viewAs: null as ViewAsState | null,
    realUser: state.user,
    realProfile: state.profile,
  };
}

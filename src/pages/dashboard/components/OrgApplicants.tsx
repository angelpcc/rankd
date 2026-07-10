import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Opportunity, Profile, Fighter } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import VerifiedBadge from '@/components/base/VerifiedBadge';

interface Application {
  id: string;
  opportunity_id: string;
  fighter_profile_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  fighter_profile?: Profile;
  fighter?: Fighter;
}

interface Props {
  opportunities: Opportunity[];
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onOpenMessages?: () => void;
}

const statusConfig = {
  pending:  { label: 'Pendiente',  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  accepted: { label: 'Aceptado',   color: 'bg-green-500/10 text-green-400 border-green-500/30',   dot: 'bg-green-400' },
  rejected: { label: 'Rechazado',  color: 'bg-red-500/10 text-red-400 border-red-500/30',         dot: 'bg-red-400' },
};

const disciplineLabels: Record<string, string> = {
  boxing: 'Boxeo', mma: 'MMA', kickboxing: 'Kickboxing',
  muay_thai: 'Muay Thai', wrestling: 'Wrestling', bjj: 'BJJ', other: 'Otro',
};

const levelLabels: Record<string, string> = {
  amateur: 'Amateur',
  semi_pro: 'Semi-Pro',
  professional: 'Profesional',
};

const levelColors: Record<string, string> = {
  amateur: 'bg-zinc-700 text-zinc-300 border-zinc-600',
  semi_pro: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  professional: 'bg-red-500/10 text-red-400 border-red-500/30',
};

function ApplicantCard({
  app,
  updatingId,
  onUpdateStatus,
  onContact,
}: {
  app: Application;
  updatingId: string | null;
  onUpdateStatus: (id: string, status: 'accepted' | 'rejected') => void;
  onContact: (fighterProfileId: string) => void;
}) {
  const p = app.fighter_profile;
  const f = app.fighter;
  const initials = (p?.full_name || 'F').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const cfg = statusConfig[app.status];
  const level = f?.experience_level || '';
  const hasSocials = p?.instagram || p?.tiktok || p?.youtube || p?.twitter;
  const record = f ? `${f.wins}V · ${f.losses}D · ${f.draws}E` : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors">
      {/* Top accent bar by status */}
      <div className={`h-0.5 w-full ${app.status === 'accepted' ? 'bg-green-500' : app.status === 'rejected' ? 'bg-red-500/40' : 'bg-zinc-700'}`} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0 relative">
            {p?.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={p.full_name || ''}
                className="w-16 h-16 rounded-xl object-cover object-top"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white text-lg font-black">
                {initials}
              </div>
            )}
            {/* Verified badge */}
            {f && f.rating >= 4 && (
              <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-green-500 rounded-full border-2 border-zinc-900">
                <i className="ri-verified-badge-fill text-white text-xs"></i>
              </div>
            )}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white truncate">
                    {p?.full_name || 'Peleador'}
                  </h3>
                  {p?.verified && (
                    <VerifiedBadge type="fighter" size="sm" showLabel={true} />
                  )}
                  {f?.nickname && (
                    <span className="text-xs text-zinc-500 italic truncate">&ldquo;{f.nickname}&rdquo;</span>
                  )}
                </div>

                {/* Tags row */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {f?.discipline && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium">
                      {disciplineLabels[f.discipline] || f.discipline}
                    </span>
                  )}
                  {f?.weight_class && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
                      {f.weight_class}
                    </span>
                  )}
                  {level && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${levelColors[level] || 'bg-zinc-700 text-zinc-300 border-zinc-600'}`}>
                      {levelLabels[level] || level}
                    </span>
                  )}
                  {p?.location && (
                    <span className="text-xs text-zinc-500 flex items-center gap-0.5">
                      <i className="ri-map-pin-line text-xs"></i>
                      {p.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                {cfg.label}
              </span>
            </div>

            {/* Record + gym */}
            {f && (
              <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-bold text-green-400">{f.wins}V</span>
                  <span className="text-zinc-600 text-xs">·</span>
                  <span className="text-xs font-bold text-red-400">{f.losses}D</span>
                  <span className="text-zinc-600 text-xs">·</span>
                  <span className="text-xs font-bold text-yellow-400">{f.draws}E</span>
                  {f.kos > 0 && (
                    <>
                      <span className="text-zinc-600 text-xs">·</span>
                      <span className="text-xs font-bold text-orange-400">{f.kos} KO</span>
                    </>
                  )}
                </div>
                {f.gym && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <i className="ri-building-4-line"></i>
                    {f.gym}
                  </span>
                )}
                {f.nationality && (
                  <span className="text-xs text-zinc-500">{f.nationality}</span>
                )}
              </div>
            )}

            {/* Social presence */}
            {hasSocials && (
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="text-xs text-zinc-600">Redes:</span>
                {p?.instagram && (
                  <a
                    href={`https://instagram.com/${p.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-instagram-line text-xs"></i>
                    {p.instagram}
                  </a>
                )}
                {p?.tiktok && (
                  <a
                    href={`https://tiktok.com/@${p.tiktok.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-zinc-700 border border-zinc-600 text-zinc-300 hover:bg-zinc-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-tiktok-line text-xs"></i>
                    {p.tiktok}
                  </a>
                )}
                {p?.youtube && (
                  <a
                    href={`https://youtube.com/@${p.youtube.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-youtube-line text-xs"></i>
                    {p.youtube}
                  </a>
                )}
                {p?.twitter && (
                  <a
                    href={`https://x.com/${p.twitter.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-zinc-700 border border-zinc-600 text-zinc-400 hover:bg-zinc-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-twitter-x-line text-xs"></i>
                    {p.twitter}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Message */}
        {app.message && (
          <div className="mt-4 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3">
            <p className="text-xs text-zinc-500 font-medium mb-1 flex items-center gap-1">
              <i className="ri-chat-quote-line"></i>
              Mensaje del candidato
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed">&ldquo;{app.message}&rdquo;</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {/* Ver perfil — primary CTA: usa fighter.id si existe, si no usa fighter_profile_id */}
          <Link
            to={`/fighter/${f?.id || app.fighter_profile_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-user-line"></i>
            Ver perfil completo
            <i className="ri-external-link-line text-zinc-500"></i>
          </Link>

          {/* Contactar */}
          <button
            onClick={() => onContact(app.fighter_profile_id)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-message-3-line"></i>
            Enviar mensaje
          </button>

          {/* Accept / Reject */}
          {app.status === 'pending' && (
            <>
              <button
                onClick={() => onUpdateStatus(app.id, 'accepted')}
                disabled={updatingId === app.id}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {updatingId === app.id ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <i className="ri-check-line"></i>
                )}
                Aceptar
              </button>
              <button
                onClick={() => onUpdateStatus(app.id, 'rejected')}
                disabled={updatingId === app.id}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <i className="ri-close-line"></i>
                Rechazar
              </button>
            </>
          )}

          {/* Re-open if already decided */}
          {app.status !== 'pending' && (
            <button
              onClick={() => onUpdateStatus(app.id, app.status === 'accepted' ? 'rejected' : 'accepted')}
              disabled={updatingId === app.id}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 ml-auto"
            >
              <i className="ri-refresh-line"></i>
              Cambiar estado
            </button>
          )}

          {/* Date */}
          <span className="text-xs text-zinc-600 ml-auto flex items-center gap-1">
            <i className="ri-calendar-line"></i>
            {new Date(app.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OrgApplicants({ opportunities, showToast, onOpenMessages }: Props) {
  const { profile: currentProfile } = useAuth();
  const [selectedOppId, setSelectedOppId] = useState<string>(opportunities[0]?.id || '');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [contactingId, setContactingId] = useState<string | null>(null);

  const loadApplications = useCallback(async (oppId: string) => {
    if (!oppId) return;
    setLoading(true);
    const { data: apps } = await supabase
      .from('applications')
      .select('*')
      .eq('opportunity_id', oppId)
      .order('created_at', { ascending: false });

    if (!apps || apps.length === 0) {
      setApplications([]);
      setLoading(false);
      return;
    }

    const profileIds = apps.map((a) => a.fighter_profile_id);
    const [{ data: profiles }, { data: fighters }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', profileIds),
      supabase.from('fighters').select('*').in('profile_id', profileIds),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const fighterMap = new Map((fighters || []).map((f) => [f.profile_id, f]));

    const enriched: Application[] = apps.map((a) => ({
      ...a,
      fighter_profile: profileMap.get(a.fighter_profile_id),
      fighter: fighterMap.get(a.fighter_profile_id),
    }));

    setApplications(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedOppId) loadApplications(selectedOppId);
  }, [selectedOppId, loadApplications]);

  const createConversationOnAccept = async (fighterProfileId: string) => {
    if (!currentProfile?.id) return;
    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_1.eq.${currentProfile.id},participant_2.eq.${fighterProfileId}),and(participant_1.eq.${fighterProfileId},participant_2.eq.${currentProfile.id})`
      )
      .maybeSingle();
    if (existing) return; // already exists

    await supabase.from('conversations').insert({
      participant_1: currentProfile.id,
      participant_2: fighterProfileId,
      last_message: '¡Candidatura aceptada! Puedes iniciar la conversación.',
      last_message_at: new Date().toISOString(),
    });
  };

  const updateStatus = async (appId: string, status: 'accepted' | 'rejected') => {
    setUpdatingId(appId);
    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', appId);
    if (error) {
      showToast('Error al actualizar el estado', 'error');
    } else {
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status } : a))
      );
      if (status === 'accepted') {
        const app = applications.find((a) => a.id === appId);
        if (app) {
          await createConversationOnAccept(app.fighter_profile_id);
        }
        showToast('✓ Candidato aceptado — conversación iniciada en Mensajes');
      } else {
        showToast('Candidato rechazado');
      }
    }
    setUpdatingId(null);
  };

  const handleContact = async (fighterProfileId: string) => {
    if (!currentProfile?.id || contactingId) return;
    setContactingId(fighterProfileId);
    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(participant_1.eq.${currentProfile.id},participant_2.eq.${fighterProfileId}),and(participant_1.eq.${fighterProfileId},participant_2.eq.${currentProfile.id})`
        )
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase.from('conversations').insert({
          participant_1: currentProfile.id,
          participant_2: fighterProfileId,
          last_message: null,
          last_message_at: new Date().toISOString(),
        });
        if (error) { showToast('No se pudo iniciar la conversación', 'error'); setContactingId(null); return; }
      }
      showToast('Conversación lista en Mensajes');
      if (onOpenMessages) onOpenMessages();
    } catch {
      showToast('No se pudo iniciar la conversación', 'error');
    }
    setContactingId(null);
  };

  const selectedOpp = opportunities.find((o) => o.id === selectedOppId);
  const openOpps = opportunities.filter((o) => o.status === 'open');
  const closedOpps = opportunities.filter((o) => o.status === 'closed');

  const filteredApps = applications.filter((a) =>
    filterStatus === 'all' ? true : a.status === filterStatus
  );

  const counts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
        <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600">
          <i className="ri-user-search-line text-4xl"></i>
        </div>
        <p className="text-zinc-400 text-sm font-medium">No tienes oportunidades publicadas</p>
        <p className="text-zinc-500 text-xs mt-1">Crea una oportunidad para empezar a recibir candidatos.</p>
      </div>
    );
  }

  return (
    <>
      {/* Contact coming soon modal */}

      <div className="flex flex-col lg:flex-row gap-5 min-h-[500px]">
        {/* Left: opportunity selector */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-3">Tus oportunidades</p>

          {openOpps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-600 px-1">Abiertas</p>
              {openOpps.map((opp) => {
                const appCount = applications.filter(() => selectedOppId === opp.id).length;
                return (
                  <button
                    key={opp.id}
                    onClick={() => { setSelectedOppId(opp.id); setFilterStatus('all'); }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer ${selectedOppId === opp.id ? 'bg-red-600/10 border-red-500/40 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}
                  >
                    <p className="text-sm font-medium truncate">{opp.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-green-400">Abierta</span>
                      <span className="text-xs text-zinc-600">·</span>
                      <span className="text-xs text-zinc-500 capitalize">{opp.type}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {closedOpps.length > 0 && (
            <div className="space-y-1.5 mt-3">
              <p className="text-xs text-zinc-600 px-1">Cerradas</p>
              {closedOpps.map((opp) => (
                <button
                  key={opp.id}
                  onClick={() => { setSelectedOppId(opp.id); setFilterStatus('all'); }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer opacity-60 ${selectedOppId === opp.id ? 'bg-zinc-800 border-zinc-600 text-white opacity-100' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                >
                  <p className="text-sm font-medium truncate">{opp.title}</p>
                  <span className="text-xs text-zinc-500">Cerrada</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: applicants list */}
        <div className="flex-1 min-w-0">
          {selectedOpp && (
            <div className="mb-5 pb-4 border-b border-zinc-800">
              <h3 className="text-base font-semibold text-white">{selectedOpp.title}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-zinc-500 capitalize">{selectedOpp.type}</span>
                {selectedOpp.discipline && (
                  <span className="text-xs text-zinc-500">{disciplineLabels[selectedOpp.discipline] || selectedOpp.discipline}</span>
                )}
                {selectedOpp.location && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <i className="ri-map-pin-line"></i>{selectedOpp.location}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border ${selectedOpp.status === 'open' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                  {selectedOpp.status === 'open' ? 'Abierta' : 'Cerrada'}
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3 text-zinc-600">
                <i className="ri-inbox-line text-3xl"></i>
              </div>
              <p className="text-zinc-400 text-sm">Sin candidatos aún</p>
              <p className="text-zinc-500 text-xs mt-1">Los peleadores que se postulen aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter tabs */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
                {(['all', 'pending', 'accepted', 'rejected'] as const).map((s) => {
                  const labels = { all: 'Todos', pending: 'Pendientes', accepted: 'Aceptados', rejected: 'Rechazados' };
                  const active = filterStatus === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap font-medium ${active ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {labels[s]}
                      {counts[s] > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-zinc-600 text-zinc-200' : 'bg-zinc-800 text-zinc-500'}`}>
                          {counts[s]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredApps.length === 0 ? (
                <div className="text-center py-10 bg-zinc-900 border border-zinc-800 rounded-2xl">
                  <p className="text-zinc-500 text-sm">No hay candidatos en este estado.</p>
                </div>
              ) : (
                filteredApps.map((app) => (
                  <ApplicantCard
                    key={app.id}
                    app={app}
                    updatingId={updatingId}
                    onUpdateStatus={updateStatus}
                    onContact={handleContact}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, Opportunity, OpportunityType, Profile } from '@/lib/supabase';
import { todayISO, isPastEvent, validateEventDate } from '@/lib/opportunityDate';

const typeOptions: { value: OpportunityType; label: string }[] = [
  { value: 'combate', label: 'Combate' },
  { value: 'sparring', label: 'Sparring' },
  { value: 'campamento', label: 'Campamento' },
  { value: 'entrenamiento', label: 'Entrenamiento' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'patrocinio', label: 'Patrocinio' },
  { value: 'scouting', label: 'Scouting' },
];

const disciplines = [
  { value: '', label: 'Todas' },
  { value: 'boxing', label: 'Boxeo' },
  { value: 'mma', label: 'MMA' },
  { value: 'kickboxing', label: 'Kickboxing' },
  { value: 'muay_thai', label: 'Muay Thai' },
  { value: 'wrestling', label: 'Wrestling' },
  { value: 'bjj', label: 'BJJ' },
];

const weightClasses = [
  '', 'Minimosca', 'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Superligero',
  'Welter', 'Superwelter', 'Medio', 'Supermedio', 'Semipesado', 'Crucero', 'Pesado',
];

const expLevels = [
  { value: '', label: 'Cualquier nivel' },
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi_pro', label: 'Semi-Pro' },
  { value: 'professional', label: 'Profesional' },
];

const typeConfig: Record<string, { color: string; icon: string }> = {
  combate:       { color: 'bg-red-500/12 text-red-400 border-red-500/30',         icon: 'ri-boxing-line' },
  contrato:      { color: 'bg-white/[0.05] text-zinc-300 border-white/10',        icon: 'ri-file-text-line' },
  patrocinio:    { color: 'bg-yellow-500/12 text-yellow-400 border-yellow-500/30', icon: 'ri-hand-coin-line' },
  sparring:      { color: 'bg-orange-500/12 text-orange-400 border-orange-500/30', icon: 'ri-user-shared-line' },
  campamento:    { color: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30', icon: 'ri-tent-line' },
  entrenamiento: { color: 'bg-sky-500/12 text-sky-400 border-sky-500/30',         icon: 'ri-run-line' },
  scouting:      { color: 'bg-violet-500/12 text-violet-400 border-violet-500/30', icon: 'ri-eye-line' },
};

interface Props {
  profile: Profile;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onDataChange?: () => void;
}

const emptyForm = {
  title: '',
  type: 'combate' as OpportunityType,
  discipline: '',
  weight_class: '',
  experience_level: '',
  location: '',
  event_date: '',
  description: '',
};

export default function OrgOpportunities({ profile, showToast, onDataChange }: Props) {
  const { t } = useTranslation();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [applicationsCount, setApplicationsCount] = useState<Record<string, number>>({});

  const loadOpportunities = useCallback(async () => {
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });
    const opps = data || [];
    setOpportunities(opps);
    setLoading(false);

    if (opps.length > 0) {
      const ids = opps.map((o) => o.id);
      const { data: apps } = await supabase
        .from('applications')
        .select('opportunity_id')
        .in('opportunity_id', ids);
      if (apps) {
        const counts: Record<string, number> = {};
        apps.forEach((a) => {
          counts[a.opportunity_id] = (counts[a.opportunity_id] || 0) + 1;
        });
        setApplicationsCount(counts);
      }
    }
  }, [profile.id]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (opp: Opportunity) => {
    setForm({
      title: opp.title,
      type: opp.type,
      discipline: opp.discipline || '',
      weight_class: opp.weight_class || '',
      experience_level: opp.experience_level || '',
      location: opp.location || '',
      event_date: opp.event_date || '',
      description: opp.description || '',
    });
    setEditingId(opp.id);
    setShowForm(true);
  };

  const saveOpportunity = async () => {
    if (!form.title.trim()) {
      showToast('El título es obligatorio', 'error');
      return;
    }
    // La fecha del evento es obligatoria y debe ser hoy o futura (bloque 3).
    const dateErr = validateEventDate(form.event_date);
    if (dateErr) {
      showToast(t(dateErr), 'error');
      return;
    }
    setSaving(true);
    const payload = {
      profile_id: profile.id,
      title: form.title.trim(),
      type: form.type,
      discipline: form.discipline || null,
      weight_class: form.weight_class || null,
      experience_level: form.experience_level || null,
      location: form.location.trim() || null,
      event_date: form.event_date || null,
      description: form.description.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase
        .from('opportunities')
        .update(payload)
        .eq('id', editingId);
      if (error) {
        showToast('Error al actualizar', 'error');
        setSaving(false);
        return;
      }
      showToast('Oportunidad actualizada');
    } else {
      const { error } = await supabase
        .from('opportunities')
        .insert({ ...payload, status: 'open' });
      if (error) {
        showToast('Error al publicar', 'error');
        setSaving(false);
        return;
      }
      showToast('Oportunidad publicada');
    }

    setSaving(false);
    setShowForm(false);
    loadOpportunities();
    onDataChange?.();
  };

  // Comprobamos el error antes de tocar la interfaz: si no, el usuario ve el
  // cambio aplicado aunque en la base de datos no se haya guardado.
  const toggleStatus = async (opp: Opportunity) => {
    const newStatus = opp.status === 'open' ? 'closed' : 'open';
    const { error } = await supabase.from('opportunities').update({ status: newStatus }).eq('id', opp.id);
    if (error) { showToast('No se pudo cambiar el estado', 'error'); return; }
    setOpportunities((prev) =>
      prev.map((o) => (o.id === opp.id ? { ...o, status: newStatus } : o))
    );
    showToast(newStatus === 'open' ? 'Oportunidad abierta' : 'Oportunidad cerrada');
  };

  const deleteOpportunity = async (id: string) => {
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar', 'error'); return; }
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    showToast('Oportunidad eliminada');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Mis Oportunidades</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {opportunities.length} publicada{opportunities.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i> Nueva oportunidad
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {editingId ? 'Editar oportunidad' : 'Nueva oportunidad'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Título *</label>
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 placeholder-zinc-600"
              placeholder="Ej: Busco sparring peso welter para campamento en Madrid"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Tipo *</label>
              <select
                value={form.type}
                onChange={(e) => setField('type', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Disciplina */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Disciplina</label>
              <select
                value={form.discipline}
                onChange={(e) => setField('discipline', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                {disciplines.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Peso */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Categoría de peso</label>
              <select
                value={form.weight_class}
                onChange={(e) => setField('weight_class', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                <option value="">Cualquier categoría</option>
                {weightClasses.filter(Boolean).map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            {/* Nivel */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Nivel requerido</label>
              <select
                value={form.experience_level}
                onChange={(e) => setField('experience_level', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                {expLevels.map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                ))}
              </select>
            </div>

            {/* Ubicación */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Ubicación</label>
              <input
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 placeholder-zinc-600"
                placeholder="Madrid, España"
              />
            </div>

            {/* Fecha (obligatoria y futura) */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t('op_date_label')} <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.event_date}
                min={todayISO()}
                onChange={(e) => setField('event_date', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 cursor-pointer"
              />
              <p className="text-xs text-zinc-500 mt-1">{t('op_date_help')}</p>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none placeholder-zinc-600"
              placeholder="Describe los detalles: requisitos, condiciones, qué ofreces..."
            />
            <p className="text-xs text-zinc-500 text-right mt-1">{form.description.length}/500</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:border-zinc-500 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              onClick={saveOpportunity}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="ri-check-line"></i>
                  {editingId ? 'Actualizar' : 'Publicar'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {opportunities.length === 0 && !showForm && (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 text-zinc-600">
            <i className="ri-megaphone-line text-4xl"></i>
          </div>
          <p className="text-zinc-400 text-sm">No has publicado ninguna oportunidad aún.</p>
          <p className="text-zinc-500 text-xs mt-1">Crea tu primera oportunidad para conectar con peleadores.</p>
          <button
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i> Crear primera oportunidad
          </button>
        </div>
      )}

      {/* List */}
      {opportunities.length > 0 && (
        <div className="space-y-3">
          {opportunities.map((opp) => {
            const cfg = typeConfig[opp.type] || typeConfig.combate;
            const appCount = applicationsCount[opp.id] || 0;
            return (
              <div
                key={opp.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      <i className={cfg.icon}></i>
                      {typeOptions.find((t) => t.value === opp.type)?.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${opp.status === 'open' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                      {opp.status === 'open' ? 'Abierta' : 'Cerrada'}
                    </span>
                    {isPastEvent(opp.event_date) && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-zinc-800 border-zinc-700 text-zinc-500 flex items-center gap-1">
                        <i className="ri-archive-line"></i>{t('op_expired')}
                      </span>
                    )}
                    {appCount > 0 && (
                      <span className="text-xs bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                        {appCount} postulación{appCount !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{opp.title}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {opp.location && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <i className="ri-map-pin-line"></i>{opp.location}
                      </span>
                    )}
                    {opp.event_date && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <i className="ri-calendar-line"></i>
                        {new Date(opp.event_date).toLocaleDateString('es-ES')}
                      </span>
                    )}
                    {opp.discipline && (
                      <span className="text-xs text-zinc-500 capitalize">{opp.discipline.replace('_', ' ')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(opp)}
                    title="Editar"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
                  >
                    <i className="ri-edit-line text-sm"></i>
                  </button>
                  <button
                    onClick={() => toggleStatus(opp)}
                    title={opp.status === 'open' ? 'Cerrar' : 'Abrir'}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${opp.status === 'open' ? 'border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-500/50' : 'border-green-500/30 text-green-400 hover:border-green-500'}`}
                  >
                    <i className={opp.status === 'open' ? 'ri-pause-line text-sm' : 'ri-play-line text-sm'}></i>
                  </button>
                  <button
                    onClick={() => deleteOpportunity(opp.id)}
                    title="Eliminar"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer"
                  >
                    <i className="ri-delete-bin-line text-sm"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

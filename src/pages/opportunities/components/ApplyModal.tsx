import { useState } from 'react';
import { Opportunity } from '@/lib/supabase';

const typeLabels: Record<string, string> = {
  combate: 'Combate', contrato: 'Contrato', patrocinio: 'Patrocinio',
  sparring: 'Sparring', campamento: 'Campamento', entrenamiento: 'Entrenamiento', scouting: 'Scouting',
};

interface Props {
  opportunity: Opportunity;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

export default function ApplyModal({ opportunity, onClose, onSubmit }: Props) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(message);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-zinc-950 px-6 py-5 flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-400 mb-1 capitalize">{typeLabels[opportunity.type] || opportunity.type}</p>
            <h2 className="text-base font-bold text-white leading-snug">{opportunity.title}</h2>
            {opportunity.location && (
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                <i className="ri-map-pin-line"></i>{opportunity.location}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer flex-shrink-0 ml-4">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <label className="block text-sm font-semibold text-zinc-800 mb-2">
            Mensaje de presentación <span className="text-zinc-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Preséntate brevemente: tu experiencia, por qué te interesa esta oportunidad..."
            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-400 resize-none"
          />
          <p className="text-xs text-zinc-400 text-right mt-1">{message.length}/500</p>

          <div className="flex gap-3 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Enviando...</>
                : <><i className="ri-send-plane-line"></i> Enviar postulación</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

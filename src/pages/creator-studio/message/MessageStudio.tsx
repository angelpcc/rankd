import { useState } from 'react';
import { useContentGenerationAvailable } from '../lib/useAvailable';
import { generateMessage, generateVariation, type GeneratedMessage, type MessageInput } from '@/services/contentGeneration';
import { createContent, type ContentRow } from '../lib/contentStore';
import { MESSAGE_TEMPLATES } from '../lib/templates';
import ContentLibrary from '../components/ContentLibrary';
import ContentEditorModal from '../components/ContentEditorModal';

const ACCENT = '#38bdf8';
const RECIPIENTS: { value: MessageInput['recipientType']; label: string }[] = [
  { value: 'fighter', label: 'Peleador' }, { value: 'organization', label: 'Organización' }, { value: 'brand', label: 'Marca' },
  { value: 'gym', label: 'Gimnasio' }, { value: 'coach', label: 'Entrenador' }, { value: 'collaborator', label: 'Colaborador' },
  { value: 'sponsor', label: 'Patrocinador' }, { value: 'other', label: 'Otros' },
];
const CHANNELS: { value: MessageInput['channel']; label: string; icon: string }[] = [
  { value: 'email', label: 'Email', icon: 'ri-mail-line' }, { value: 'whatsapp', label: 'WhatsApp', icon: 'ri-whatsapp-line' },
  { value: 'instagram', label: 'IG DM', icon: 'ri-instagram-line' }, { value: 'linkedin', label: 'LinkedIn', icon: 'ri-linkedin-box-line' },
  { value: 'sms', label: 'SMS', icon: 'ri-message-2-line' }, { value: 'other', label: 'Otro', icon: 'ri-chat-3-line' },
];
const TONES: { value: MessageInput['tone']; label: string }[] = [
  { value: 'formal', label: 'Formal' }, { value: 'casual', label: 'Casual' }, { value: 'urgente', label: 'Urgente' },
  { value: 'motivador', label: 'Motivador' }, { value: 'tecnico', label: 'Técnico' },
];

function MessagePreview({ content, channel }: { content: GeneratedMessage; channel: MessageInput['channel'] }) {
  if (channel === 'whatsapp' || channel === 'instagram' || channel === 'sms') {
    return (
      <div className="rounded-2xl p-4" style={{ background: '#0d1a14' }}>
        <div className="rounded-2xl rounded-tl-sm bg-[#1f2c25] text-white text-sm px-4 py-2.5 max-w-[85%] whitespace-pre-wrap">{content.body}</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
      {content.subject && <p className="text-sm font-bold text-white">Asunto: {content.subject}</p>}
      <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{content.body}</p>
    </div>
  );
}

export default function MessageStudio() {
  const available = useContentGenerationAvailable();
  const [goal, setGoal] = useState('');
  const [recipientType, setRecipientType] = useState<MessageInput['recipientType']>('brand');
  const [channel, setChannel] = useState<MessageInput['channel']>('email');
  const [context, setContext] = useState('');
  const [receivedMessage, setReceivedMessage] = useState('');
  const [tone, setTone] = useState<MessageInput['tone']>('formal');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<ContentRow<GeneratedMessage> | null>(null);

  const generate = async () => {
    if (!goal.trim() && !receivedMessage.trim()) return;
    setGenerating(true);
    setError(null);
    const res = await generateMessage({ goal: goal.trim(), recipientType, channel, context: context.trim(), receivedMessage: receivedMessage.trim(), tone });
    setGenerating(false);
    if (res.error || !res.data) { setError(res.error || 'No se pudo generar el mensaje.'); return; }
    const title = goal.trim().slice(0, 60) || `Respuesta a ${RECIPIENTS.find((r) => r.value === recipientType)?.label}`;
    const row = await createContent('message', channel, title, goal || receivedMessage, res.data);
    if (!row) { setError('Se generó pero no se pudo guardar.'); return; }
    setGoal(''); setReceivedMessage('');
    setRefreshKey((k) => k + 1);
    setEditing(row);
  };

  return (
    <div className="space-y-6">
      <div className="rk-card space-y-4" style={{ padding: 20 }}>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">¿Cuál es tu objetivo?</label>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} maxLength={400}
            placeholder="Ej: proponer una colaboración de patrocinio"
            style={{ fontSize: 16 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500 resize-y" />
          <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1">
            {MESSAGE_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => { setGoal(t.goal); setRecipientType(t.recipientType as MessageInput['recipientType']); }} style={{ minHeight: 36 }}
                className="flex-shrink-0 text-[11px] font-semibold text-zinc-300 bg-white/[0.04] border border-white/10 hover:border-white/25 rounded-full px-3 cursor-pointer whitespace-nowrap">
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Destinatario</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {RECIPIENTS.map((r) => (
              <button key={r.value} onClick={() => setRecipientType(r.value)} style={{ minHeight: 36 }}
                className={`flex-shrink-0 px-3 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${recipientType === r.value ? 'bg-sky-500/25 border-sky-500 text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Canal</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as MessageInput['channel'])}
              style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 cursor-pointer">
              {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Tono</label>
            <select value={tone} onChange={(e) => setTone(e.target.value as MessageInput['tone'])}
              style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-3 cursor-pointer">
              {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Contexto <span className="text-zinc-600">(opcional)</span></label>
          <input value={context} onChange={(e) => setContext(e.target.value)} maxLength={300}
            style={{ fontSize: 16, minHeight: 44 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500" />
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">¿Estás respondiendo? Pega el mensaje recibido <span className="text-zinc-600">(opcional)</span></label>
          <textarea value={receivedMessage} onChange={(e) => setReceivedMessage(e.target.value)} rows={2} maxLength={2000}
            style={{ fontSize: 16 }} className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500 resize-y" />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button onClick={generate} disabled={generating || (!goal.trim() && !receivedMessage.trim()) || available === false} style={{ minHeight: 44, background: ACCENT }}
          className="w-full flex items-center justify-center gap-2 text-zinc-900 text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {generating
            ? <><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div> Generando...</>
            : <>✉️ Generar mensaje</>}
        </button>
        {available === false && (
          <p className="text-[11px] text-[#C9A84C] flex items-center gap-1.5"><i className="ri-time-line"></i>IA disponible pronto: falta la clave de Anthropic en el servidor.</p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-500 mb-3">Biblioteca de mensajes</p>
        <ContentLibrary<GeneratedMessage> type="message" refreshKey={refreshKey} onOpen={setEditing} accent={ACCENT}
          subtypeLabel={(s) => CHANNELS.find((c) => c.value === s)?.label || s || ''} />
      </div>

      {editing && (
        <ContentEditorModal<GeneratedMessage>
          row={editing} accent={ACCENT} available={available === true}
          onClose={() => setEditing(null)}
          onSaved={(r) => { setEditing(r); setRefreshKey((k) => k + 1); }}
          onGenerateVariation={(content) => generateVariation<GeneratedMessage>('message', content)}
          renderFields={(content, setContent) => (
            <div className="space-y-3">
              {content.subject !== null && (
                <input value={content.subject || ''} placeholder="Asunto" onChange={(e) => setContent({ ...content, subject: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
              )}
              <textarea value={content.body} placeholder="Mensaje" rows={6} onChange={(e) => setContent({ ...content, body: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2 resize-y" />
              <p className="text-[10px] text-zinc-600">{content.body.length} caracteres</p>
              <input value={content.cta} placeholder="CTA" onChange={(e) => setContent({ ...content, cta: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2" />
              {content.alternatives.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Alternativas</p>
                  {content.alternatives.map((alt, i) => (
                    <button key={i} onClick={() => setContent({ ...content, body: alt })}
                      className="w-full text-left text-xs text-zinc-400 bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2 hover:border-white/25 cursor-pointer">
                      {alt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          renderPreview={(content) => <MessagePreview content={content} channel={editing.subtype as MessageInput['channel']} />}
        />
      )}
    </div>
  );
}

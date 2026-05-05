import { useState, useEffect, useRef } from 'react';
import { Message, Conversation } from '@/hooks/useMessages';

interface Props {
  conversation: Conversation;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  currentUserId: string;
  onSend: (content: string) => Promise<boolean>;
}

function formatMsgTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export default function ChatWindow({ conversation, messages, loading, sending, currentUserId, onSend }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const other = conversation.other_user;
  const initials = (other.full_name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input;
    setInput('');
    await onSend(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800 flex-shrink-0">
        <div className="relative flex-shrink-0">
          {other.avatar_url ? (
            <img src={other.avatar_url} alt={other.full_name || ''} className="w-10 h-10 rounded-full object-cover object-top" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-zinc-900"></span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{other.full_name || 'Usuario'}</p>
          <p className="text-xs text-green-400">En línea</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500 mb-3">
              <i className="ri-chat-smile-2-line text-3xl"></i>
            </div>
            <p className="text-sm font-semibold text-zinc-300">Inicia la conversación</p>
            <p className="text-xs text-zinc-500 mt-1">Envía el primer mensaje a {other.full_name?.split(' ')[0] || 'este usuario'}</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isMine = msg.sender_id === currentUserId;
              const prevMsg = messages[idx - 1];
              const showDateSep = !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);
              const prevSameSender = prevMsg && prevMsg.sender_id === msg.sender_id && !showDateSep;

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-zinc-800"></div>
                      <span className="text-xs text-zinc-500 font-medium px-2">{formatDateSeparator(msg.created_at)}</span>
                      <div className="flex-1 h-px bg-zinc-800"></div>
                    </div>
                  )}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${prevSameSender ? 'mt-0.5' : 'mt-3'}`}>
                    <div className={`max-w-[72%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed break-words ${
                          isMine
                            ? 'bg-red-600 text-white rounded-2xl rounded-br-md'
                            : 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-bl-md'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-xs text-zinc-600">{formatMsgTime(msg.created_at)}</span>
                        {isMine && (
                          <i className={`text-xs ${msg.read_at ? 'ri-check-double-line text-red-400' : 'ri-check-line text-zinc-600'}`}></i>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-800">
        <div className="flex items-end gap-3 bg-zinc-800 rounded-2xl px-4 py-2.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Mensaje a ${other.full_name?.split(' ')[0] || 'usuario'}...`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 resize-none focus:outline-none max-h-32 leading-relaxed"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
              input.trim() && !sending
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <i className="ri-send-plane-fill text-base"></i>
            )}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-1.5 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </div>
  );
}

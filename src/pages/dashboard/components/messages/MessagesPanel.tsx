import { useState } from 'react';
import { useMessages } from '@/hooks/useMessages';
import MessagesInbox from './MessagesInbox';
import ChatWindow from './ChatWindow';

interface Props {
  currentUserId: string;
}

export default function MessagesPanel({ currentUserId }: Props) {
  const {
    conversations,
    loadingConvos,
    activeConvoId,
    messages,
    loadingMessages,
    sending,
    selectConversation,
    sendMessage,
  } = useMessages(currentUserId);

  const [mobileView, setMobileView] = useState<'inbox' | 'chat'>('inbox');

  const activeConvo = conversations.find((c) => c.id === activeConvoId) || null;

  const handleSelect = (id: string) => {
    selectConversation(id);
    setMobileView('chat');
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Sidebar — inbox */}
      <div className={`w-full lg:w-80 flex-shrink-0 border-r border-zinc-800 flex flex-col ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
        {/* Inbox header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-base font-bold text-white">Mensajes</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{conversations.length} conversación{conversations.length !== 1 ? 'es' : ''}</p>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          <MessagesInbox
            conversations={conversations}
            activeConvoId={activeConvoId}
            loading={loadingConvos}
            onSelect={handleSelect}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col min-w-0 ${mobileView === 'inbox' ? 'hidden lg:flex' : 'flex'}`}>
        {activeConvo ? (
          <>
            {/* Mobile back button */}
            <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
              <button
                onClick={() => setMobileView('inbox')}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-arrow-left-line"></i>
                Volver
              </button>
            </div>
            <ChatWindow
              conversation={activeConvo}
              messages={messages}
              loading={loadingMessages}
              sending={sending}
              currentUserId={currentUserId}
              onSend={sendMessage}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 flex items-center justify-center rounded-3xl bg-zinc-800 text-zinc-600 mb-5">
              <i className="ri-message-3-line text-4xl"></i>
            </div>
            <h3 className="text-base font-bold text-zinc-300 mb-2">Selecciona una conversación</h3>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
              Elige una conversación de la lista para empezar a chatear. Las conversaciones se crean automáticamente cuando aceptas o eres aceptado en una oportunidad.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

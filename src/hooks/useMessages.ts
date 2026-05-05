import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface ConversationParticipant {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  user_type: string;
}

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
  other_user: ConversationParticipant;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export function useMessages(currentUserId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingConvos(true);

    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${currentUserId},participant_2.eq.${currentUserId}`)
      .order('last_message_at', { ascending: false });

    if (!convos || convos.length === 0) {
      setConversations([]);
      setLoadingConvos(false);
      return;
    }

    const otherIds = convos.map((c) =>
      c.participant_1 === currentUserId ? c.participant_2 : c.participant_1
    );

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, user_type')
      .in('id', otherIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const enriched: Conversation[] = convos.map((c) => {
      const otherId = c.participant_1 === currentUserId ? c.participant_2 : c.participant_1;
      const other = profileMap.get(otherId);
      return {
        ...c,
        other_user: other || { id: otherId, full_name: 'Usuario', avatar_url: null, user_type: 'fighter' },
        unread_count: 0,
      };
    });

    setConversations(enriched);
    setLoadingConvos(false);
  }, [currentUserId]);

  const loadMessages = useCallback(async (convoId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true });

    setMessages(data || []);
    setLoadingMessages(false);

    // Mark messages as read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convoId)
      .neq('sender_id', currentUserId)
      .is('read_at', null);
  }, [currentUserId]);

  const selectConversation = useCallback((convoId: string) => {
    setActiveConvoId(convoId);
    loadMessages(convoId);
  }, [loadMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!activeConvoId || !content.trim() || sending) return false;
    setSending(true);

    const trimmed = content.trim();
    const { error } = await supabase.from('messages').insert({
      conversation_id: activeConvoId,
      sender_id: currentUserId,
      content: trimmed,
    });

    if (!error) {
      await supabase
        .from('conversations')
        .update({ last_message: trimmed, last_message_at: new Date().toISOString() })
        .eq('id', activeConvoId);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvoId
            ? { ...c, last_message: trimmed, last_message_at: new Date().toISOString() }
            : c
        ).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      );
    }

    setSending(false);
    return !error;
  }, [activeConvoId, currentUserId, sending]);

  // Create or get conversation between two users
  const getOrCreateConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    // Check if conversation already exists (either direction)
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_1.eq.${currentUserId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${currentUserId})`
      )
      .maybeSingle();

    if (existing) return existing.id;

    // Create new conversation
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ participant_1: currentUserId, participant_2: otherUserId })
      .select('id')
      .maybeSingle();

    if (error || !created) return null;
    await loadConversations();
    return created.id;
  }, [currentUserId, loadConversations]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!activeConvoId) return;

    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
    }

    const channel = supabase
      .channel(`messages:${activeConvoId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvoId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConvoId
                ? { ...c, last_message: newMsg.content, last_message_at: newMsg.created_at }
                : c
            )
          );
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [activeConvoId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    loadingConvos,
    activeConvoId,
    messages,
    loadingMessages,
    sending,
    selectConversation,
    sendMessage,
    getOrCreateConversation,
    loadConversations,
  };
}

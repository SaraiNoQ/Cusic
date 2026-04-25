'use client';

import type {
  AiDjActionDto,
  ChatMessageVm,
  ChatSessionMessageDto,
} from '@music-ai/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchContentById } from '../../../lib/api/content-api';
import {
  fetchDjSessionMessages,
  submitDjMessage,
} from '../../../lib/api/dj-api';
import { useAuthStore } from '../../../store/auth-store';
import { initialChatMessages, useChatStore } from '../../../store/chat-store';
import { usePlayerStore } from '../../../store/player-store';
import type { PlayerController } from '../../player/hooks/usePlayerController';

const chatSessionStorageKey = 'cusic-active-chat-session';

function toChatVm(message: ChatSessionMessageDto): ChatMessageVm {
  return {
    id: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    text: message.text,
  };
}

function readPersistedChatSession(userId?: string | null) {
  if (typeof window === 'undefined' || !userId) {
    return null;
  }

  const raw = window.localStorage.getItem(chatSessionStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      userId?: string;
      sessionId?: string;
    };
    return parsed.userId === userId && parsed.sessionId
      ? parsed.sessionId
      : null;
  } catch {
    return null;
  }
}

function writePersistedChatSession(userId: string, sessionId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    chatSessionStorageKey,
    JSON.stringify({ userId, sessionId }),
  );
}

function clearPersistedChatSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(chatSessionStorageKey);
}

export function useChatController(playerController: PlayerController) {
  const authUser = useAuthStore((state) => state.user);
  const sessionId = useChatStore((state) => state.sessionId);
  const input = useChatStore((state) => state.input);
  const isPending = useChatStore((state) => state.isPending);
  const messages = useChatStore((state) => state.messages);
  const hasHydratedSession = useChatStore((state) => state.hasHydratedSession);
  const setSessionId = useChatStore((state) => state.setSessionId);
  const setInput = useChatStore((state) => state.setInput);
  const setPending = useChatStore((state) => state.setPending);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const setMessages = useChatStore((state) => state.setMessages);
  const resetConversation = useChatStore((state) => state.resetConversation);
  const setHydratedSession = useChatStore((state) => state.setHydratedSession);
  const setStatusText = usePlayerStore((state) => state.setStatusText);

  const chatMutation = useMutation({
    mutationFn: async (message: string) =>
      submitDjMessage({
        sessionId,
        message,
        responseMode: 'sync',
        surfaceContext: {
          currentTrackId: playerController.currentTrack?.id ?? null,
          queueContentIds: playerController.queue.map((item) => item.id),
        },
      }),
  });

  useEffect(() => {
    setHydratedSession(false);
    if (authUser && sessionId?.startsWith('anon_')) {
      setSessionId(undefined);
      setMessages(initialChatMessages);
    }
  }, [authUser?.id, setHydratedSession, setMessages, setSessionId, sessionId]);

  useEffect(() => {
    if (!authUser) {
      clearPersistedChatSession();
      return;
    }

    if (sessionId) {
      writePersistedChatSession(authUser.id, sessionId);
    }
  }, [authUser, sessionId]);

  const hydrateConversation = async () => {
    if (!authUser) {
      setHydratedSession(true);
      return;
    }

    const targetSessionId = sessionId ?? readPersistedChatSession(authUser.id);
    if (!targetSessionId) {
      setHydratedSession(true);
      return;
    }

    try {
      const history = await fetchDjSessionMessages(targetSessionId);
      const nextMessages = history.map(toChatVm);
      setSessionId(targetSessionId);
      setMessages(nextMessages.length > 0 ? nextMessages : initialChatMessages);
    } catch {
      clearPersistedChatSession();
      setSessionId(undefined);
      setMessages(initialChatMessages);
    } finally {
      setHydratedSession(true);
    }
  };

  const applyActions = async (actions: AiDjActionDto[]) => {
    for (const action of actions) {
      const items = await Promise.all(
        action.payload.contentIds.map(fetchContentById),
      );

      if (items.length === 0) {
        continue;
      }

      if (action.type === 'queue_replace') {
        await playerController.replaceQueue(
          items,
          'AI DJ rewired the active queue.',
        );
      } else if (action.type === 'queue_append') {
        await playerController.appendTracks(
          items,
          'AI DJ extended the active queue.',
        );
      }
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const message = (overrideText ?? input).trim();
    if (!message || isPending) {
      return;
    }

    appendMessage({
      id: `msg_user_${Date.now()}`,
      role: 'user',
      text: message,
    });
    setInput('');
    setPending(true);

    try {
      const response = await chatMutation.mutateAsync(message);
      setSessionId(response.data.sessionId);
      appendMessage({
        id: response.data.messageId,
        role: 'assistant',
        text: response.data.replyText,
      });
      await applyActions(response.data.actions);
    } catch {
      appendMessage({
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        text: '我暂时没有收到后端信号，但播放器本身还在线。你可以先继续搜索和播放。',
      });
      setStatusText('AI DJ lane lost signal, but the player is still online.');
    } finally {
      setPending(false);
    }
  };

  return {
    sessionId,
    input,
    isPending,
    messages,
    hasHydratedSession,
    setInput,
    sendMessage,
    hydrateConversation,
    resetConversation,
  };
}

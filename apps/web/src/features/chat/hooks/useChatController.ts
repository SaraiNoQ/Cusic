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
  saveAiPlaylist,
  streamDjMessage,
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
    intent: message.intent ?? null,
    actions: message.actions ?? [],
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
  const setStreamingMessageId = useChatStore(
    (state) => state.setStreamingMessageId,
  );
  const appendMessage = useChatStore((state) => state.appendMessage);
  const upsertMessage = useChatStore((state) => state.upsertMessage);
  const updateMessageText = useChatStore((state) => state.updateMessageText);
  const setMessages = useChatStore((state) => state.setMessages);
  const resetConversation = useChatStore((state) => state.resetConversation);
  const setHydratedSession = useChatStore((state) => state.setHydratedSession);
  const setChatError = useChatStore((state) => state.setChatError);
  const setStatusText = usePlayerStore((state) => state.setStatusText);

  const chatMutation = useMutation({
    mutationFn: async (message: string) =>
      submitDjMessage({
        sessionId,
        message,
        responseMode: 'stream',
        surfaceContext: {
          currentTrackId: playerController.currentTrack?.id ?? null,
          queueContentIds: playerController.queue.map((item) => item.id),
        },
      }),
  });

  const savePlaylistMutation = useMutation({
    mutationFn: async ({
      sessionId,
      messageId,
    }: {
      sessionId: string;
      messageId: string;
    }) => saveAiPlaylist({ sessionId, messageId }),
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

    const abortController = new AbortController();
    const userMsgId = `msg_user_${Date.now()}`;

    appendMessage({
      id: userMsgId,
      role: 'user',
      text: message,
    });
    setInput('');
    setPending(true);

    try {
      const response = await chatMutation.mutateAsync(message);
      setSessionId(response.data.sessionId);

      const assistantMsgId = response.data.messageId;
      let messageCreated = false;
      let streamedReply = '';
      let streamedActions = response.data.actions;
      let streamedIntent = response.data.intent;

      setStreamingMessageId(assistantMsgId);

      const ensureMessage = () => {
        if (!messageCreated) {
          messageCreated = true;
          upsertMessage({
            id: assistantMsgId,
            role: 'assistant',
            text: '',
            intent: streamedIntent,
            actions: streamedActions,
          });
        }
      };

      try {
        await streamDjMessage(
          {
            sessionId: response.data.sessionId,
            messageId: assistantMsgId,
          },
          (event) => {
            if (event.event === 'chunk') {
              ensureMessage();
              streamedReply += event.delta;
              updateMessageText(assistantMsgId, streamedReply);
              return;
            }

            if (event.event === 'actions') {
              streamedActions = event.actions;
              upsertMessage({
                id: assistantMsgId,
                role: 'assistant',
                text: streamedReply,
                intent: streamedIntent,
                actions: streamedActions,
              });
              applyActions(event.actions);
              return;
            }

            if (event.event === 'done') {
              if (event.actions && event.actions.length > 0) {
                streamedActions = event.actions;
              }
              if (event.intent) {
                streamedIntent = event.intent;
              }

              const finalText =
                event.replyText || streamedReply || response.data.replyText;
              upsertMessage({
                id: assistantMsgId,
                role: 'assistant',
                text: finalText,
                intent: streamedIntent,
                actions: streamedActions,
              });
            }
          },
          abortController.signal,
        );
      } catch {
        if (!messageCreated && response.data.replyText) {
          upsertMessage({
            id: assistantMsgId,
            role: 'assistant',
            text: response.data.replyText,
            intent: response.data.intent,
            actions: response.data.actions,
          });
        }
      }

      if (!streamedReply && !messageCreated) {
        upsertMessage({
          id: assistantMsgId,
          role: 'assistant',
          text: response.data.replyText || '我暂时没能收到完整的回复，请重试。',
          intent: response.data.intent,
          actions: response.data.actions,
        });
      }

      if (streamedActions.length > 0) {
        await applyActions(streamedActions);
      }
    } catch {
      appendMessage({
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        text: '我暂时没有收到后端信号，但播放器本身还在线。你可以先继续搜索和播放。',
      });
      setChatError('AI DJ 暂时无法连接，请检查网络后重试。');
      setStatusText('AI DJ lane lost signal, but the player is still online.');
    } finally {
      abortController.abort();
      setPending(false);
      setStreamingMessageId(null);
    }
  };

  const savePlaylistFromMessage = async (messageId: string) => {
    if (!authUser) {
      setStatusText('Login is required before AI DJ can save a playlist.');
      return;
    }

    if (!sessionId) {
      setStatusText('This AI DJ draft is not attached to a live session yet.');
      return;
    }

    try {
      const result = await savePlaylistMutation.mutateAsync({
        sessionId,
        messageId,
      });
      if (result.playlist?.id) {
        playerController.setSelectedPlaylistId(result.playlist.id);
      }
      void playerController.refreshPlaylists();
      setStatusText(
        result.created
          ? `Saved ${result.playlist?.title ?? 'the AI DJ draft'} to your library.`
          : `${result.playlist?.title ?? 'That AI DJ draft'} is already in your library.`,
      );
    } catch {
      setChatError('保存歌单失败，请稍后重试。');
      setStatusText('AI DJ could not persist that draft into your library.');
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
    savePlaylistFromMessage,
    savingPlaylistMessageId: savePlaylistMutation.isPending
      ? savePlaylistMutation.variables?.messageId
      : undefined,
    hydrateConversation,
    resetConversation,
    canSaveGeneratedPlaylists: Boolean(authUser),
  };
}

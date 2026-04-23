'use client';

import type { AiDjActionDto } from '@music-ai/shared';
import { useMutation } from '@tanstack/react-query';
import { fetchContentById } from '../../../lib/api/content-api';
import { submitDjMessage } from '../../../lib/api/dj-api';
import { useChatStore } from '../../../store/chat-store';
import { usePlayerStore } from '../../../store/player-store';
import type { PlayerController } from '../../player/hooks/usePlayerController';

export function useChatController(playerController: PlayerController) {
  const sessionId = useChatStore((state) => state.sessionId);
  const input = useChatStore((state) => state.input);
  const isPending = useChatStore((state) => state.isPending);
  const messages = useChatStore((state) => state.messages);
  const setSessionId = useChatStore((state) => state.setSessionId);
  const setInput = useChatStore((state) => state.setInput);
  const setPending = useChatStore((state) => state.setPending);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const setStatusText = usePlayerStore((state) => state.setStatusText);

  const chatMutation = useMutation({
    mutationFn: async (message: string) =>
      submitDjMessage({
        sessionId,
        message,
        responseMode: 'sync',
      }),
  });

  const applyActions = async (actions: AiDjActionDto[]) => {
    const queueReplace = actions.find(
      (action) =>
        action.type === 'queue_replace' && action.payload.contentIds?.length,
    );

    if (!queueReplace?.payload.contentIds?.length) {
      return;
    }

    const items = await Promise.all(
      queueReplace.payload.contentIds.map(fetchContentById),
    );
    if (items.length === 0) {
      return;
    }

    await playerController.replaceQueue(
      items,
      'AI DJ rewired the active queue.',
    );
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
    setInput,
    sendMessage,
  };
}

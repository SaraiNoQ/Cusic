import { useEffect, useRef } from 'react';
import type { ChatMessageVm } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';
import { KnowledgeCard, type KnowledgeCardProps } from './KnowledgeCard';

import type { AiDjIntent } from '@music-ai/shared';

function getActionLabel(intent: AiDjIntent | null | undefined) {
  switch (intent) {
    case 'theme_playlist_preview':
      return { primary: 'SAVE PLAYLIST', secondary: 'QUEUE IT' };
    case 'queue_replace':
      return { primary: 'REPLACE QUEUE', secondary: 'REPLAY' };
    case 'queue_append':
      return { primary: 'APPEND TO QUEUE', secondary: 'ENQUEUE' };
    case 'recommend_explain':
      return { primary: 'EXPLORE', secondary: 'PLAY ALL' };
    default:
      return { primary: 'APPLY', secondary: 'ENQUEUE' };
  }
}

function parseKnowledgeData(content: unknown): KnowledgeCardProps | null {
  if (!content) return null;
  if (typeof content === 'object' && content !== null) {
    const data = content as Record<string, unknown>;
    if (data.summaryText && typeof data.summaryText === 'string') {
      return {
        title: typeof data.title === 'string' ? data.title : undefined,
        summaryText: data.summaryText,
        sources: Array.isArray(data.sources)
          ? (data.sources as Array<{ title: string; url?: string }>)
          : undefined,
        relatedContent: Array.isArray(data.relatedContent)
          ? (data.relatedContent as Array<{ contentId: string; title: string }>)
          : undefined,
      };
    }
  }
  // Try parsing JSON string
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (parsed.summaryText && typeof parsed.summaryText === 'string') {
        return {
          title: typeof parsed.title === 'string' ? parsed.title : undefined,
          summaryText: parsed.summaryText,
          sources: Array.isArray(parsed.sources)
            ? (parsed.sources as Array<{ title: string; url?: string }>)
            : undefined,
          relatedContent: Array.isArray(parsed.relatedContent)
            ? (parsed.relatedContent as Array<{
                contentId: string;
                title: string;
              }>)
            : undefined,
        };
      }
    } catch {
      // Not valid JSON, fall through
    }
  }
  return null;
}

export function ChatMessageList({
  messages,
  isPending,
  canSaveGeneratedPlaylists,
  savingPlaylistMessageId,
  onSavePlaylist,
}: Readonly<{
  messages: ChatMessageVm[];
  isPending: boolean;
  canSaveGeneratedPlaylists: boolean;
  savingPlaylistMessageId?: string;
  onSavePlaylist: (messageId: string) => void;
}>) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isPending]);

  return (
    <div className={styles.messageList} ref={listRef}>
      {messages.map((message) => {
        const hasActions = (message.actions?.length ?? 0) > 0;
        const labels = getActionLabel(message.intent);
        const isKnowledge =
          (message.intent as string) === 'knowledge_query' ||
          (message as ChatMessageVm & { type?: string }).type === 'knowledge';
        const knowledgeData = isKnowledge
          ? parseKnowledgeData(
              (message as ChatMessageVm & { content?: unknown }).content ??
                message.text,
            )
          : null;

        if (isKnowledge && knowledgeData) {
          return <KnowledgeCard key={message.id} {...knowledgeData} />;
        }

        return (
          <article
            key={message.id}
            className={
              message.role === 'assistant'
                ? `${styles.chatBubble} ${styles.chatBubbleAssistant}`
                : `${styles.chatBubble} ${styles.chatBubbleUser}`
            }
          >
            <div className={styles.chatBubbleTopline}>
              <span className={styles.chatRole}>
                {message.role === 'assistant' ? 'AI DJ' : 'COMMAND'}
              </span>
              {message.intent ? (
                <span className={styles.chatBubbleIndex}>
                  {message.intent.toUpperCase()}
                </span>
              ) : (
                <span className={styles.chatBubbleIndex}>TX</span>
              )}
            </div>
            <p>{message.text}</p>
            {message.role === 'assistant' && hasActions ? (
              <div className={styles.chatBubbleActions}>
                {message.intent === 'theme_playlist_preview' &&
                canSaveGeneratedPlaylists ? (
                  <button
                    type="button"
                    className={styles.chatActionButton}
                    onClick={() => onSavePlaylist(message.id)}
                    disabled={savingPlaylistMessageId === message.id}
                  >
                    {savingPlaylistMessageId === message.id
                      ? 'SAVING...'
                      : labels.primary}
                  </button>
                ) : (
                  <span className={styles.chatActionHint}>
                    {hasActions && message.actions
                      ? `${message.actions.length} track${message.actions.length > 1 ? 's' : ''} queued`
                      : null}
                  </span>
                )}
              </div>
            ) : null}
          </article>
        );
      })}

      {isPending ? (
        <article
          className={`${styles.chatBubble} ${styles.chatBubbleAssistant}`}
        >
          <div className={styles.chatBubbleTopline}>
            <span className={styles.chatRole}>AI DJ</span>
            <span className={styles.chatBubbleIndex}>LIVE</span>
          </div>
          <p>
            Calibrating a new transmission path through the current library…
          </p>
        </article>
      ) : null}
    </div>
  );
}

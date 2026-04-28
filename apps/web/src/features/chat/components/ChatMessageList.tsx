import { useEffect, useRef } from 'react';
import type { ChatMessageVm } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';

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

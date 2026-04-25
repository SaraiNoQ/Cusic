import type { ChatMessageVm } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';

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
  return (
    <div className={styles.messageList}>
      {messages.map((message) => (
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
            <span className={styles.chatBubbleIndex}>TX</span>
          </div>
          <p>{message.text}</p>
          {canSaveGeneratedPlaylists &&
          message.role === 'assistant' &&
          message.intent === 'theme_playlist_preview' &&
          (message.actions?.length ?? 0) > 0 ? (
            <div className={styles.chatBubbleActions}>
              <button
                type="button"
                className={styles.chatActionButton}
                onClick={() => onSavePlaylist(message.id)}
                disabled={savingPlaylistMessageId === message.id}
              >
                {savingPlaylistMessageId === message.id
                  ? 'SAVING...'
                  : 'SAVE PLAYLIST'}
              </button>
            </div>
          ) : null}
        </article>
      ))}

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

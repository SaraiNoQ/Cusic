import type { ChatMessageVm } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';

export function ChatMessageList({
  messages,
  isPending,
}: Readonly<{
  messages: ChatMessageVm[];
  isPending: boolean;
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

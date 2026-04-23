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
          <span className={styles.chatRole}>
            {message.role === 'assistant' ? 'AI DJ' : 'You'}
          </span>
          <p>{message.text}</p>
        </article>
      ))}
      {isPending ? (
        <article
          className={`${styles.chatBubble} ${styles.chatBubbleAssistant}`}
        >
          <span className={styles.chatRole}>AI DJ</span>
          <p>Retuning the deck…</p>
        </article>
      ) : null}
    </div>
  );
}

import type { ChatMessageVm } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';

export function DjConsole({
  messages,
  isPending,
}: Readonly<{
  messages: ChatMessageVm[];
  isPending: boolean;
}>) {
  return (
    <section className={styles.djConsole}>
      <div className={styles.djConsoleHeader}>
        <span className={styles.djLabel}>AI DJ</span>
        <span className={styles.djStatus}>CHANNEL OPEN</span>
      </div>
      <div className={styles.djMessageList}>
        {messages.length === 0 && !isPending ? (
          <div className={styles.djStandby}>
            <span className={styles.djStandbyText}>AWAITING TRANSMISSION</span>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === 'assistant'
                    ? `${styles.djMessage} ${styles.djMessageAssistant}`
                    : `${styles.djMessage} ${styles.djMessageUser}`
                }
              >
                <span className={styles.djMessageRole}>
                  {message.role === 'assistant' ? 'DJ' : 'YOU'}
                </span>
                <p className={styles.djMessageText}>{message.text}</p>
              </article>
            ))}
            {isPending && (
              <article
                className={`${styles.djMessage} ${styles.djMessageAssistant}`}
              >
                <span className={styles.djMessageRole}>DJ</span>
                <p className={styles.djMessageText}>Tuning in...</p>
              </article>
            )}
          </>
        )}
      </div>
    </section>
  );
}

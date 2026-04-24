import type { ContentItemDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';

export function QueueStrip({
  queue,
  activeIndex,
  onSelectIndex,
}: Readonly<{
  queue: ContentItemDto[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
}>) {
  const activeTrack = queue[activeIndex] ?? queue[0] ?? null;

  return (
    <section className={styles.queuePanel}>
      <div className={styles.queueHeader}>
        <span>QUEUE</span>
        <span>{queue.length} TRACKS</span>
      </div>
      <button
        type="button"
        className={styles.queueChannel}
        disabled={!activeTrack}
        onClick={() => {
          if (activeTrack) {
            onSelectIndex(Math.max(activeIndex, 0));
          }
        }}
      >
        <span className={styles.queueStatusDot} />
        <span className={styles.queueName}>Cusic</span>
        <span className={styles.queueNow}>
          {activeTrack ? activeTrack.title : 'LIVE'}
        </span>
        <strong>LIVE</strong>
      </button>
    </section>
  );
}

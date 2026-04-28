import type { ContentItemDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';

export function QueueStrip({
  queue,
  activeIndex,
  canOpenImports,
  onOpenQueue,
  onOpenRecommendation,
  onOpenImports,
}: Readonly<{
  queue: ContentItemDto[];
  activeIndex: number;
  canOpenImports: boolean;
  onOpenQueue: () => void;
  onOpenRecommendation: () => void;
  onOpenImports: () => void;
}>) {
  const activeTrack = queue[activeIndex] ?? queue[0] ?? null;

  return (
    <section className={styles.queuePanel}>
      <div className={styles.queueHeader}>
        <span>QUEUE</span>
        <div className={styles.queueHeaderMeta}>
          {canOpenImports ? (
            <button
              type="button"
              className={styles.queueUtilityButton}
              onClick={onOpenImports}
            >
              IMPORT
            </button>
          ) : null}
          <button
            type="button"
            className={styles.queueUtilityButton}
            onClick={onOpenRecommendation}
          >
            RADAR
          </button>
          <span>{queue.length} TRACKS</span>
        </div>
      </div>
      <button
        type="button"
        className={styles.queueChannel}
        onClick={onOpenQueue}
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

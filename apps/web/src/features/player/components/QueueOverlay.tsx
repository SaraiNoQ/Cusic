import type { ContentItemDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';

export function QueueOverlay({
  isOpen,
  queue,
  activeIndex,
  onClose,
  onSelectIndex,
}: Readonly<{
  isOpen: boolean;
  queue: ContentItemDto[];
  activeIndex: number;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
}>) {
  if (!isOpen) return null;

  return (
    <section className={styles.overlay}>
      <div
        className={styles.overlayFog}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={styles.queueOverlayCard}>
        <div className={styles.queueOverlayHeader}>
          <h2>QUEUE</h2>
          <span>{queue.length} TRACKS</span>
          <button
            type="button"
            className={styles.queueOverlayClose}
            onClick={onClose}
          >
            CLOSE
          </button>
        </div>

        <div className={styles.queueOverlayList}>
          {queue.length === 0 ? (
            <p className={styles.queueOverlayEmpty}>
              The queue lane is empty. Search for music to start building your
              session.
            </p>
          ) : (
            queue.map((track, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={track.id}
                  type="button"
                  className={`${styles.queueOverlayItem} ${isActive ? styles.queueOverlayItemActive : ''}`}
                  onClick={() => {
                    onSelectIndex(index);
                    onClose();
                  }}
                >
                  <span className={styles.queueOverlayIndex}>
                    {isActive ? '▶' : String(index + 1).padStart(2, '0')}
                  </span>
                  <div className={styles.queueOverlayTrackInfo}>
                    <strong>{track.title}</strong>
                    <span>
                      {track.artists?.join(', ') ?? 'Unknown Artist'}
                    </span>
                  </div>
                  <span className={styles.queueOverlayDuration}>
                    {track.type === 'podcast' ? 'POD' : 'TRK'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

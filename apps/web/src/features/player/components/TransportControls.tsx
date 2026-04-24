import styles from '../PlayerScreen.module.css';

export function TransportControls({
  isPlaying,
  onPrevious,
  onTogglePlayPause,
  onNext,
}: Readonly<{
  isPlaying: boolean;
  onPrevious: () => void;
  onTogglePlayPause: () => void;
  onNext: () => void;
}>) {
  return (
    <div className={styles.transportRow}>
      <button
        type="button"
        className={styles.transportButton}
        onClick={onPrevious}
        aria-label="Previous track"
      >
        ◀◀
      </button>
      <button
        type="button"
        className={`${styles.transportButton} ${styles.transportButtonMain}`}
        onClick={onTogglePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <button
        type="button"
        className={styles.transportButton}
        onClick={onNext}
        aria-label="Next track"
      >
        ▶▶
      </button>
    </div>
  );
}

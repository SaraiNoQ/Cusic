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
      >
        ‹
      </button>
      <button
        type="button"
        className={styles.transportButtonMain}
        onClick={onTogglePlayPause}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button type="button" className={styles.transportButton} onClick={onNext}>
        ›
      </button>
    </div>
  );
}

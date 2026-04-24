import styles from '../PlayerScreen.module.css';

export function DeviceHeader({
  onOpenSearch,
}: Readonly<{
  onOpenSearch: () => void;
  isPlaying: boolean;
  statusText: string;
}>) {
  return (
    <header className={styles.deviceHeader}>
      <button
        type="button"
        className={styles.brandMark}
        onClick={onOpenSearch}
        aria-label="Open library search"
      >
        <span className={styles.brandCrescent}>C</span>
        <span className={styles.brandWordmark}>USIC</span>
      </button>

      <div className={styles.headerActions}>
        <button type="button" className={styles.loginButton}>
          LOGIN
        </button>
        <button
          type="button"
          className={styles.searchButton}
          onClick={onOpenSearch}
          aria-label="Search library"
        >
          <span className={styles.searchGlyph} aria-hidden="true" />
          SEARCH
        </button>

        <div className={styles.headerSegmented} aria-label="Display mode">
          <button type="button" className={styles.headerSegmentActive}>
            DARK
          </button>
          <button type="button">LIGHT</button>
        </div>
      </div>
    </header>
  );
}

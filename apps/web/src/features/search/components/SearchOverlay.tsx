import type { ContentItemDto } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';
import { initialsOf } from '../../player/player-utils';

export function SearchOverlay({
  isOpen,
  query,
  isSearching,
  total,
  items,
  onClose,
  onQueryChange,
  onPlay,
  onQueue,
  onAssist,
}: Readonly<{
  isOpen: boolean;
  query: string;
  isSearching: boolean;
  total: number;
  items: ContentItemDto[];
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onPlay: (track: ContentItemDto) => void;
  onQueue: (track: ContentItemDto) => void;
  onAssist: (track: ContentItemDto) => void;
}>) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className={styles.overlay}>
      <div className={styles.overlayFog} onClick={onClose} aria-hidden="true" />
      <div className={styles.searchOverlayCard}>
        <header className={styles.searchHeader}>
          <div>
            <span className={styles.searchEyebrow}>LIBRARY SEARCH</span>
            <h2>Signal acquisition terminal</h2>
          </div>
          <button
            type="button"
            className={styles.searchClose}
            onClick={onClose}
          >
            CLOSE
          </button>
        </header>

        <div className={styles.searchForm}>
          <div className={styles.searchInputWrap}>
            <span className={styles.searchInputLabel}>QUERY</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search title, artist, mood, or era..."
              autoFocus
            />
          </div>
          <div className={styles.searchMeta}>
            <span>{isSearching ? 'SCANNING' : 'RESULTS'}</span>
            <strong>{total.toString().padStart(2, '0')}</strong>
          </div>
        </div>

        <div className={styles.searchResults}>
          {items.map((track) => (
            <article key={track.id} className={styles.searchCard}>
              <div className={styles.searchCardBadge}>{initialsOf(track)}</div>
              <div className={styles.searchCardInfo}>
                <span className={styles.searchCardEyebrow}>
                  {track.type.toUpperCase()}
                </span>
                <h3>{track.title}</h3>
                <p>
                  {track.artists.join(' · ')}
                  {track.album ? ` · ${track.album}` : ''}
                </p>
              </div>
              <div className={styles.searchCardActions}>
                <button type="button" onClick={() => onPlay(track)}>
                  PLAY
                </button>
                <button type="button" onClick={() => onQueue(track)}>
                  QUEUE
                </button>
                <button type="button" onClick={() => onAssist(track)}>
                  AI DJ
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

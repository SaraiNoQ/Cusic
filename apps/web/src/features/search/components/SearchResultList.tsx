import type { ContentItemDto } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';
import { initialsOf } from '../../player/player-utils';

export function SearchResultList({
  items,
  onPlay,
  onQueue,
  onAssist,
}: Readonly<{
  items: ContentItemDto[];
  onPlay: (track: ContentItemDto) => void;
  onQueue: (track: ContentItemDto) => void;
  onAssist: (track: ContentItemDto) => void;
}>) {
  return (
    <div className={styles.searchResults}>
      {items.map((track) => (
        <article key={track.id} className={styles.searchCard}>
          <div className={styles.searchCardHead}>
            <div className={styles.searchBadge}>{initialsOf(track)}</div>
            <div>
              <h3>{track.title}</h3>
              <p>
                {track.artists.join(', ')}
                {track.album ? ` · ${track.album}` : ''}
              </p>
            </div>
          </div>
          <div className={styles.searchActions}>
            <button
              type="button"
              className={styles.searchAction}
              onClick={() => onPlay(track)}
            >
              Play
            </button>
            <button
              type="button"
              className={styles.searchAction}
              onClick={() => onQueue(track)}
            >
              Queue
            </button>
            <button
              type="button"
              className={styles.searchAction}
              onClick={() => onAssist(track)}
            >
              Ask AI
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

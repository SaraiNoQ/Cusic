import type { ContentItemDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';
import { initialsOf, trackNarrative } from '../player-utils';

export function NowPlayingPanel({
  track,
}: Readonly<{
  track: ContentItemDto | null;
}>) {
  return (
    <article className={styles.displayPanel}>
      <div className={styles.coverWindow}>
        <div className={styles.coverFrame} />
        <div className={styles.coverBadge}>{initialsOf(track)}</div>
      </div>
      <div className={styles.metaBlock}>
        <p className={styles.eyebrow}>Now Playing</p>
        <h2 className={styles.trackTitle}>
          {track?.title ?? 'No active transmission yet'}
        </h2>
        <p className={styles.trackSubline}>
          {track
            ? `${track.artists.join(', ')}${track.album ? ` · ${track.album}` : ''}`
            : 'The player is waiting for a first signal from search or AI DJ.'}
        </p>
        <p className={styles.narrative}>{trackNarrative(track)}</p>
      </div>
    </article>
  );
}

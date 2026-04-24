import type { ContentItemDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';
import { initialsOf } from '../player-utils';

export function NowPlayingPanel({
  track,
}: Readonly<{
  track: ContentItemDto | null;
}>) {
  if (!track) {
    return (
      <div className={styles.nowPlayingMeta}>
        <div className={styles.coverPlate}>
          <span className={styles.coverInitials}>—</span>
        </div>
        <div className={styles.standbyMessage}>
          <span className={styles.trackLabel}>Now Playing</span>
          <span className={styles.standbyText}>NO SIGNAL</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.nowPlayingMeta}>
      <div className={styles.coverPlate}>
        <span className={styles.coverInitials}>{initialsOf(track)}</span>
      </div>
      <div className={styles.trackInfo}>
        <span className={styles.trackLabel}>Now Playing</span>
        <h2 className={styles.trackTitle}>{track.title}</h2>
        <p className={styles.trackArtist}>
          {track.artists.join(', ')}
          {track.album ? ` · ${track.album}` : ''}
        </p>
      </div>
    </div>
  );
}

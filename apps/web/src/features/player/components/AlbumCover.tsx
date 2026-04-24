import type { ContentItemDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';
import { initialsOf } from '../player-utils';

export function AlbumCover({
  track,
  isPlaying,
}: Readonly<{
  track: ContentItemDto;
  isPlaying: boolean;
}>) {
  return (
    <div className={styles.albumDisplay}>
      <div
        className={`${styles.albumEmission} ${isPlaying ? styles.albumEmissionLive : ''}`}
      />
      <div className={styles.albumTelemetry}>
        <span>LIVE COVER</span>
        <span>{track.album ?? 'SINGLE FEED'}</span>
      </div>
      <div className={styles.albumFrame}>
        <div className={styles.albumFrameInner}>
          {track.coverUrl ? (
            <img
              className={styles.albumImage}
              src={track.coverUrl}
              alt={track.title}
            />
          ) : (
            <div className={styles.albumFallback}>{initialsOf(track)}</div>
          )}
          <div className={styles.albumReflection} />
          <div className={styles.albumScan} />
        </div>
      </div>
      <div className={styles.albumMetaRail}>
        <div>
          <span className={styles.albumMetaLabel}>TRACK</span>
          <strong>{track.title}</strong>
        </div>
        <div>
          <span className={styles.albumMetaLabel}>ARTIST</span>
          <strong>{track.artists.join(' / ')}</strong>
        </div>
      </div>
    </div>
  );
}

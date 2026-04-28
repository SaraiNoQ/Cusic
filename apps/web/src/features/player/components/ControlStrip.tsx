import type { ContentItemDto } from '@music-ai/shared';
import type { CSSProperties } from 'react';
import styles from '../PlayerScreen.module.css';
import { formatClock } from '../player-utils';

export function ControlStrip({
  track,
  isPlaying,
  isFavorite,
  progressSeconds,
  durationSeconds,
  statusText,
  volume,
  onVolumeChange,
  onPrevious,
  onTogglePlayPause,
  onNext,
  onToggleFavorite,
  onAddToPlaylist,
}: Readonly<{
  track: ContentItemDto | null;
  isPlaying: boolean;
  isFavorite: boolean;
  progressSeconds: number;
  durationSeconds: number;
  statusText: string;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onPrevious: () => void;
  onTogglePlayPause: () => void;
  onNext: () => void;
  onToggleFavorite: () => void;
  onAddToPlaylist: () => void;
}>) {
  const progressPercent =
    durationSeconds > 0
      ? Math.min((progressSeconds / durationSeconds) * 100, 100)
      : 0;
  const volumeStyle = {
    '--volume-percent': `${Math.round(volume * 100)}%`,
  } as CSSProperties;
  const artists = track?.artists.join(' · ') ?? 'PLAYING';

  return (
    <section className={styles.controlStrip} aria-label={statusText}>
      <div className={styles.controlPanel}>
        <div className={styles.trackCluster}>
          <div className={styles.equalizerIcon} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className={styles.trackCopy}>
            <h2>
              {track
                ? `${track.title} - ${track.artists[0] ?? 'Cusic'}`
                : 'If - Bread'}
            </h2>
            <p>{artists}</p>
          </div>
        </div>

        <div className={styles.transportCluster}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onPrevious}
            aria-label="Previous track"
          >
            <span>◀</span>
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.pauseButton}`}
            onClick={onTogglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <span>{isPlaying ? 'Ⅱ' : '▶'}</span>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onNext}
            aria-label="Next track"
          >
            <span>▶</span>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onTogglePlayPause}
            aria-label="Stop"
          >
            <span>■</span>
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${isFavorite ? styles.iconButtonActive : ''}`}
            onClick={onToggleFavorite}
            aria-label={isFavorite ? 'Remove favorite' : 'Favorite'}
          >
            <span>{isFavorite ? '♥' : '♡'}</span>
          </button>
        </div>

        <div className={styles.utilityCluster}>
          <button
            type="button"
            className={styles.pillButton}
            aria-label="Hide player"
          >
            HIDE
          </button>
          <button
            type="button"
            className={styles.pillButton}
            onClick={onAddToPlaylist}
            aria-label="Save to playlist"
          >
            FAV
          </button>
          <div className={styles.volumeMeter}>
            <span>VOL</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              style={volumeStyle}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className={styles.volumeSlider}
            />
          </div>
        </div>
      </div>

      <div className={styles.progressRow}>
        <span>{formatClock(progressSeconds)}</span>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span>{formatClock(durationSeconds)}</span>
      </div>
    </section>
  );
}

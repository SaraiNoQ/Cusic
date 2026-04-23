import type { ContentItemDto } from '@music-ai/shared';
import { SignalDecor } from '../../atmosphere/components/SignalDecor';
import styles from '../PlayerScreen.module.css';
import { formatDuration } from '../player-utils';
import { NowPlayingPanel } from './NowPlayingPanel';
import { ProgressRail } from './ProgressRail';
import { SearchTrigger } from './SearchTrigger';
import { TransportControls } from './TransportControls';

export function PlayerHero({
  currentTrack,
  queue,
  activeIndex,
  statusText,
  isPlaying,
  progressSeconds,
  durationSeconds,
  isFavorite,
  onOpenSearch,
  onPrevious,
  onTogglePlayPause,
  onNext,
  onToggleFavorite,
  onAddToPlaylist,
  onSelectQueueIndex,
}: Readonly<{
  currentTrack: ContentItemDto | null;
  queue: ContentItemDto[];
  activeIndex: number;
  statusText: string;
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  isFavorite: boolean;
  onOpenSearch: () => void;
  onPrevious: () => void;
  onTogglePlayPause: () => void;
  onNext: () => void;
  onToggleFavorite: () => void;
  onAddToPlaylist: () => void;
  onSelectQueueIndex: (index: number) => void;
}>) {
  return (
    <section className={styles.playerZone}>
      <header className={styles.playerHeader}>
        <div className={styles.titleStack}>
          <p className={styles.eyebrow}>Cusic / Signal Deck</p>
          <h1>Future radio surface with an embedded AI listening assistant.</h1>
        </div>
        <SearchTrigger onClick={onOpenSearch} />
      </header>

      <section className={styles.statusRail}>
        <span className={styles.statusDot} />
        <p>{statusText}</p>
        <SignalDecor />
      </section>

      <div className={styles.playerDeck}>
        <NowPlayingPanel track={currentTrack} />

        <aside className={styles.meterPanel}>
          <article className={styles.meterStack}>
            <p className={styles.eyebrow}>Frequency Window</p>
            <div className={styles.meterGraph} aria-hidden="true">
              {Array.from({ length: 11 }).map((_, index) => (
                <span
                  key={`meter-${index}`}
                  style={{ height: `${24 + ((index * 13) % 56)}px` }}
                />
              ))}
            </div>
            <p className={styles.narrative}>
              Half-screen player mode is tuned like a compact console: one
              focused play surface, one visible signal response, no oversized
              rotating hardware metaphor.
            </p>
          </article>

          <article className={styles.controlPanel}>
            <p className={styles.eyebrow}>Transport</p>
            <ProgressRail
              progressSeconds={progressSeconds}
              durationSeconds={durationSeconds}
            />
            <TransportControls
              isPlaying={isPlaying}
              onPrevious={onPrevious}
              onTogglePlayPause={onTogglePlayPause}
              onNext={onNext}
            />
            <div className={styles.quickActions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={onToggleFavorite}
              >
                {isFavorite ? 'Unsave' : 'Save'}
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={onAddToPlaylist}
              >
                Add Playlist
              </button>
            </div>
          </article>

          <article className={styles.queuePanel}>
            <p className={styles.eyebrow}>Up Next</p>
            <div className={styles.queueList}>
              {queue.slice(0, 3).map((track, index) => (
                <button
                  key={track.id}
                  type="button"
                  className={
                    index === activeIndex
                      ? `${styles.queueItem} ${styles.queueItemActive}`
                      : styles.queueItem
                  }
                  onClick={() => onSelectQueueIndex(index)}
                >
                  <span>
                    <span className={styles.queueTitle}>{track.title}</span>
                    <span className={styles.queueMeta}>
                      {track.artists.join(', ')}
                    </span>
                  </span>
                  <span>{formatDuration(track.durationMs)}</span>
                </button>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

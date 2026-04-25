import type { DailyPlaylistDto, NowRecommendationDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';
import { RecommendationPanel } from './RecommendationPanel';

export function RecommendationOverlay({
  isOpen,
  nowRecommendation,
  dailyPlaylist,
  onClose,
  onPlay,
  onQueue,
  onLoadDaily,
}: Readonly<{
  isOpen: boolean;
  nowRecommendation: NowRecommendationDto | null;
  dailyPlaylist: DailyPlaylistDto | null;
  onClose: () => void;
  onPlay: (content: NowRecommendationDto['items'][number]['content']) => void;
  onQueue: (content: NowRecommendationDto['items'][number]['content']) => void;
  onLoadDaily: () => void;
}>) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className={styles.overlay}>
      <div className={styles.overlayFog} onClick={onClose} aria-hidden="true" />
      <div className={styles.recommendationOverlayCard}>
        <header className={styles.searchHeader}>
          <div>
            <span className={styles.searchEyebrow}>CURATED SIGNALS</span>
            <h2>Recommendation radar</h2>
          </div>
          <button
            type="button"
            className={styles.searchClose}
            onClick={onClose}
          >
            CLOSE
          </button>
        </header>

        <div className={styles.recommendationOverlayBody}>
          <RecommendationPanel
            nowRecommendation={nowRecommendation}
            dailyPlaylist={dailyPlaylist}
            onPlay={onPlay}
            onQueue={onQueue}
            onLoadDaily={onLoadDaily}
          />
        </div>
      </div>
    </section>
  );
}

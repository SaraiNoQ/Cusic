import { useState } from 'react';
import type { DailyPlaylistDto, NowRecommendationDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';

export function RecommendationPanel({
  nowRecommendation,
  dailyPlaylist,
  onPlay,
  onQueue,
  onLoadDaily,
  onFeedback,
}: Readonly<{
  nowRecommendation: NowRecommendationDto | null;
  dailyPlaylist: DailyPlaylistDto | null;
  onPlay: (contentId: NowRecommendationDto['items'][number]['content']) => void;
  onQueue: (
    contentId: NowRecommendationDto['items'][number]['content'],
  ) => void;
  onLoadDaily: () => void;
  onFeedback?: (
    contentId: string,
    feedbackType: 'like' | 'dislike',
  ) => void;
}>) {
  const items = nowRecommendation?.items ?? [];
  const [feedbackState, setFeedbackState] = useState<
    Record<string, 'liked' | 'disliked' | null>
  >({});

  const handleFeedback = (contentId: string, type: 'like' | 'dislike') => {
    const current = feedbackState[contentId];
    const next = current === type ? null : type;
    setFeedbackState((prev) => ({ ...prev, [contentId]: next }));
    onFeedback?.(contentId, next ?? type);
  };

  return (
    <section className={styles.recommendationPanel}>
      <article className={styles.recommendationCard}>
        <div className={styles.recommendationHeader}>
          <span>NOW</span>
          <p>
            {nowRecommendation?.explanation ?? 'Reading the current lane...'}
          </p>
        </div>

        <div className={styles.recommendationList}>
          {items.map((item) => (
            <div key={item.contentId} className={styles.recommendationItem}>
              <div className={styles.recommendationCopy}>
                <strong>{item.title}</strong>
                <span>{item.reason}</span>
              </div>
              <div className={styles.recommendationActions}>
                <button type="button" onClick={() => onPlay(item.content)}>
                  PLAY
                </button>
                <button type="button" onClick={() => onQueue(item.content)}>
                  QUEUE
                </button>
                {onFeedback ? (
                  <>
                    <button
                      type="button"
                      className={
                        feedbackState[item.contentId] === 'liked'
                          ? styles.feedbackButtonActive
                          : undefined
                      }
                      onClick={() => handleFeedback(item.contentId, 'like')}
                      title="Like this recommendation"
                    >
                      {feedbackState[item.contentId] === 'liked'
                        ? '★'
                        : '☆'}
                    </button>
                    <button
                      type="button"
                      className={
                        feedbackState[item.contentId] === 'disliked'
                          ? styles.feedbackButtonActive
                          : undefined
                      }
                      onClick={() =>
                        handleFeedback(item.contentId, 'dislike')
                      }
                      title="Not interested"
                    >
                      {feedbackState[item.contentId] === 'disliked'
                        ? '✕'
                        : '×'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className={styles.dailyCard}>
        <div className={styles.recommendationHeader}>
          <span>DAILY</span>
          <p>
            {dailyPlaylist?.description ?? 'Preparing today&apos;s sequence...'}
          </p>
        </div>

        <div className={styles.dailySummary}>
          <div>
            <strong>{dailyPlaylist?.title ?? 'Today in Cusic'}</strong>
            <span>{dailyPlaylist?.itemCount ?? 0} ITEMS</span>
          </div>
          <button type="button" onClick={onLoadDaily}>
            LOAD
          </button>
        </div>

        <div className={styles.dailyPreview}>
          {(dailyPlaylist?.items ?? []).slice(0, 3).map((item) => (
            <span key={item.id}>{item.title}</span>
          ))}
        </div>
      </article>
    </section>
  );
}

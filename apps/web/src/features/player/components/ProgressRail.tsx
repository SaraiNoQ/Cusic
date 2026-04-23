import styles from '../PlayerScreen.module.css';
import { formatClock } from '../player-utils';

export function ProgressRail({
  progressSeconds,
  durationSeconds,
}: Readonly<{
  progressSeconds: number;
  durationSeconds: number;
}>) {
  return (
    <div>
      <div className={styles.timeline}>
        <div
          className={styles.timelineFill}
          style={{
            width:
              durationSeconds > 0
                ? `${Math.min((progressSeconds / durationSeconds) * 100, 100)}%`
                : '0%',
          }}
        />
      </div>
      <div className={styles.timelineMeta}>
        <span>{formatClock(progressSeconds)}</span>
        <span>{formatClock(durationSeconds)}</span>
      </div>
    </div>
  );
}

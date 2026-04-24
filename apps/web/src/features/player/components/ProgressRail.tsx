import styles from '../PlayerScreen.module.css';
import { formatClock } from '../player-utils';

export function ProgressRail({
  progressSeconds,
  durationSeconds,
}: Readonly<{
  progressSeconds: number;
  durationSeconds: number;
}>) {
  const progressPercent =
    durationSeconds > 0
      ? Math.min((progressSeconds / durationSeconds) * 100, 100)
      : 0;

  return (
    <div>
      <div className={styles.progressRail}>
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className={styles.progressTime}>
        <span>{formatClock(progressSeconds)}</span>
        <span>{formatClock(durationSeconds)}</span>
      </div>
    </div>
  );
}

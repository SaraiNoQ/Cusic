'use client';

import { useEffect, useState } from 'react';
import type { ContentItemDto } from '@music-ai/shared';
import styles from '../PlayerScreen.module.css';
import { formatTime, formatWeekday, formatDate } from '../player-utils';

export function HeroDisplay({
  isPlaying,
  currentTrack,
}: Readonly<{
  isPlaying: boolean;
  currentTrack: ContentItemDto | null;
}>) {
  const [time, setTime] = useState(() => formatTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const signalState = isPlaying
    ? 'ON AIR'
    : currentTrack
      ? 'STANDBY'
      : 'NO SIGNAL';

  return (
    <section className={styles.heroDisplay}>
      <div className={styles.heroClock}>{time}</div>
      <div className={styles.heroDate}>
        <span>{formatWeekday()}</span>
        <span className={styles.heroDateDivider}>·</span>
        <span>{formatDate()}</span>
      </div>
      <div className={styles.heroSignal}>
        <span
          className={isPlaying ? styles.signalDotLive : styles.signalDotIdle}
        />
        <span className={styles.heroSignalText}>{signalState}</span>
      </div>
    </section>
  );
}

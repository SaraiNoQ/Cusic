'use client';

import { useEffect, useState } from 'react';
import styles from '../PlayerScreen.module.css';

const digitRows: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['11110', '00001', '00001', '01110', '10000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01111', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '11110'],
};

function getClockLabel(date: Date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${hours}${minutes}`;
}

function getWeekday(date: Date): string {
  return (
    [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ][date.getDay()] ?? 'Standby'
  );
}

function getDateLabel(date: Date): string {
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];

  return `${date.getDate().toString().padStart(2, '0')} · ${months[date.getMonth()] ?? '---'} · ${date.getFullYear()}`;
}

function MatrixDigit({ value }: Readonly<{ value: string }>) {
  const rows = digitRows[value] ?? digitRows['0'];

  return (
    <div className={styles.matrixDigit} aria-hidden="true">
      {rows.flatMap((row, rowIndex) =>
        row
          .split('')
          .map((cell, cellIndex) => (
            <span
              key={`${rowIndex}-${cellIndex}`}
              className={
                cell === '1'
                  ? `${styles.matrixCell} ${styles.matrixCellActive}`
                  : styles.matrixCell
              }
            />
          )),
      )}
    </div>
  );
}

export function FlipClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const clockLabel = now ? getClockLabel(now) : '0000';

  return (
    <div
      className={styles.clockStack}
      aria-label={
        now ? `Current time ${now.toLocaleTimeString()}` : 'Clock loading'
      }
    >
      <div className={styles.matrixReadout}>
        <MatrixDigit value={clockLabel[0] ?? '0'} />
        <MatrixDigit value={clockLabel[1] ?? '0'} />
        <div className={styles.matrixColon} aria-hidden="true">
          <span />
          <span />
        </div>
        <MatrixDigit value={clockLabel[2] ?? '0'} />
        <MatrixDigit value={clockLabel[3] ?? '0'} />
      </div>
      <div className={styles.clockDateStack}>
        <strong>{now ? getWeekday(now) : 'Standby'}</strong>
        <span>{now ? getDateLabel(now) : '00 · APR · 2026'}</span>
        <p>
          <span className={styles.onAirDot} />
          ON AIR
        </p>
      </div>
    </div>
  );
}

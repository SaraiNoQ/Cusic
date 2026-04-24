import type { ContentItemDto } from '@music-ai/shared';

export function formatDuration(durationMs?: number | null) {
  if (!durationMs) {
    return '--:--';
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatClock(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return '0:00';
  }

  const minutes = Math.floor(seconds / 60);
  const remain = Math.floor(seconds % 60);

  return `${minutes}:${remain.toString().padStart(2, '0')}`;
}

export function formatTime(date: Date = new Date()): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function formatWeekday(date: Date = new Date()): string {
  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return weekdays[date.getDay()];
}

export function formatDate(date: Date = new Date()): string {
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
  const day = date.getDate();
  const month = months[date.getMonth()];
  return `${day} ${month}`;
}

export function initialsOf(track?: ContentItemDto | null) {
  if (!track) {
    return 'CU';
  }

  return track.title
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function trackNarrative(track?: ContentItemDto | null) {
  if (!track) {
    return 'Use search or AI DJ to load the first signal into the player.';
  }

  if (track.type === 'podcast') {
    return 'Editorial voice lane armed for spoken-word listening.';
  }

  if (track.language === 'zh') {
    return 'Hong Kong neon contours and late-night radio warmth are currently in focus.';
  }

  if (track.language === 'instrumental') {
    return 'Low-distraction frequency field, tuned for long-form concentration.';
  }

  return 'The deck is currently aligned with a nocturnal editorial listening profile.';
}

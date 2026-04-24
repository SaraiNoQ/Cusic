export type QueueItemRecord = {
  contentId: string;
};

export type QueueMode = 'replace' | 'append';

export type QueueStateRecord = {
  activeIndex?: number;
  currentContentId?: string | null;
  positionMs?: number;
};

export type PlaybackEventRecord = {
  contentId: string;
  eventType: 'PLAY_STARTED' | 'PLAY_PAUSED' | 'PLAY_COMPLETED' | 'SKIPPED';
  positionMs?: number;
  occurredAt: string;
};

import { Injectable } from '@nestjs/common';
import type {
  PlaybackEventRecord,
  QueueItemRecord,
  QueueMode,
} from '../types/event-record.type';

@Injectable()
export class EventsService {
  private queue: QueueItemRecord[] = [];

  private events: PlaybackEventRecord[] = [];

  updateQueue(mode: QueueMode, items: QueueItemRecord[]) {
    this.queue = mode === 'replace' ? items : [...this.queue, ...items];

    return {
      queueId: 'queue_demo',
      mode,
      count: this.queue.length,
      items: this.queue,
    };
  }

  recordPlaybackEvent(event: PlaybackEventRecord) {
    this.events = [event, ...this.events].slice(0, 100);

    return {
      accepted: true,
      eventType: event.eventType,
      totalEvents: this.events.length,
    };
  }
}

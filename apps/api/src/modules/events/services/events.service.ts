import { Injectable } from '@nestjs/common';
import { EventType } from '@prisma/client';
import { ContentService } from '../../content/services/content.service';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  PlaybackEventRecord,
  QueueItemRecord,
  QueueMode,
} from '../types/event-record.type';

@Injectable()
export class EventsService {
  private queue: QueueItemRecord[] = [];

  private events: PlaybackEventRecord[] = [];

  constructor(
    private readonly contentService: ContentService,
    private readonly prisma: PrismaService,
  ) {}

  updateQueue(mode: QueueMode, items: QueueItemRecord[]) {
    this.queue = mode === 'replace' ? items : [...this.queue, ...items];

    return {
      queueId: 'queue_demo',
      mode,
      count: this.queue.length,
      items: this.queue,
    };
  }

  async recordPlaybackEvent(event: PlaybackEventRecord, userId?: string) {
    if (userId) {
      const contentItem = await this.contentService.ensureContentItem(
        event.contentId,
      );
      if (!contentItem) {
        return {
          accepted: false,
          eventType: event.eventType,
          totalEvents: await this.prisma.playbackEvent.count({
            where: { userId },
          }),
        };
      }

      await this.prisma.playbackEvent.create({
        data: {
          userId,
          contentItemId: contentItem.id,
          eventType: this.toPrismaEventType(event.eventType),
          positionMs: event.positionMs,
          occurredAt: new Date(event.occurredAt),
        },
      });

      return {
        accepted: true,
        eventType: event.eventType,
        totalEvents: await this.prisma.playbackEvent.count({
          where: { userId },
        }),
      };
    }

    this.events = [event, ...this.events].slice(0, 100);

    return {
      accepted: true,
      eventType: event.eventType,
      totalEvents: this.events.length,
    };
  }

  private toPrismaEventType(eventType: PlaybackEventRecord['eventType']) {
    switch (eventType) {
      case 'PLAY_PAUSED':
        return EventType.PLAY_PAUSED;
      case 'PLAY_COMPLETED':
        return EventType.PLAY_COMPLETED;
      case 'SKIPPED':
        return EventType.SKIPPED;
      case 'PLAY_STARTED':
      default:
        return EventType.PLAY_STARTED;
    }
  }
}

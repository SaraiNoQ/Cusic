import { Injectable } from '@nestjs/common';
import { EventType } from '@prisma/client';
import type { ContentItem as PrismaContentItem } from '@prisma/client';
import type { PlayerQueueStateDto } from '@music-ai/shared';
import { ContentService } from '../../content/services/content.service';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  PlaybackEventRecord,
  QueueItemRecord,
  QueueMode,
  QueueStateRecord,
} from '../types/event-record.type';

@Injectable()
export class EventsService {
  private queue: QueueItemRecord[] = [];

  private events: PlaybackEventRecord[] = [];

  constructor(
    private readonly contentService: ContentService,
    private readonly prisma: PrismaService,
  ) {}

  async getQueue(userId?: string): Promise<PlayerQueueStateDto> {
    if (!userId) {
      return this.getDemoQueueState();
    }

    const session = await this.prisma.playerSession.findUnique({
      where: { userId },
      include: {
        currentContentItem: true,
        items: {
          orderBy: { position: 'asc' },
          include: { contentItem: true },
        },
      },
    });

    if (!session) {
      return {
        queueId: 'queue_empty',
        count: 0,
        items: [],
        activeIndex: -1,
        currentTrack: null,
        positionMs: 0,
      };
    }

    return this.toQueueState(session);
  }

  async updateQueue(
    mode: QueueMode,
    items: QueueItemRecord[],
    state: QueueStateRecord = {},
    userId?: string,
  ): Promise<PlayerQueueStateDto> {
    if (!userId) {
      this.queue = mode === 'replace' ? items : [...this.queue, ...items];

      return this.getDemoQueueState(mode, state);
    }

    const oldSession = await this.prisma.playerSession.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { contentItem: true },
        },
      },
    });

    const incomingIds = items.map((item) => item.contentId);
    const existingIds = oldSession?.items.map((item) => item.contentItemId) ?? [];
    const contentIds =
      mode === 'replace'
        ? incomingIds
        : [
            ...existingIds,
            ...incomingIds.filter((id) => !existingIds.includes(id)),
          ];

    const ensuredItems = (
      await Promise.all(
        contentIds.map((contentId) =>
          this.contentService.ensureContentItem(contentId),
        ),
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);
    const ensuredIds = ensuredItems.map((item) => item.id);
    const requestedActiveIndex =
      state.currentContentId && ensuredIds.includes(state.currentContentId)
        ? ensuredIds.indexOf(state.currentContentId)
        : state.activeIndex;
    const activeIndex = this.clampActiveIndex(
      requestedActiveIndex ?? oldSession?.activeIndex ?? 0,
      ensuredIds.length,
    );
    const currentContentItemId =
      ensuredIds.length > 0
        ? state.currentContentId && ensuredIds.includes(state.currentContentId)
          ? state.currentContentId
          : ensuredIds[activeIndex] ?? ensuredIds[0]
        : null;
    const positionMs =
      currentContentItemId &&
      currentContentItemId === oldSession?.currentContentItemId
        ? state.positionMs ?? oldSession.positionMs
        : state.positionMs ?? 0;

    await this.prisma.playerSession.upsert({
      where: { userId },
      create: {
        userId,
        currentContentItemId,
        activeIndex,
        positionMs,
      },
      update: {
        currentContentItemId,
        activeIndex,
        positionMs,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      const session = await tx.playerSession.findUniqueOrThrow({
        where: { userId },
      });
      await tx.playerQueueItem.deleteMany({
        where: { playerSessionId: session.id },
      });
      if (ensuredIds.length > 0) {
        await tx.playerQueueItem.createMany({
          data: ensuredIds.map((contentItemId, position) => ({
            playerSessionId: session.id,
            contentItemId,
            position,
          })),
        });
      }
    });

    return this.getQueue(userId);
  }

  private getDemoQueueState(
    mode?: QueueMode,
    state: QueueStateRecord = {},
  ): PlayerQueueStateDto {
    const items = this.contentService.getByIds(
      this.queue.map((item) => item.contentId),
    );
    const activeIndex = this.clampActiveIndex(
      state.currentContentId
        ? items.findIndex((item) => item.id === state.currentContentId)
        : state.activeIndex ?? 0,
      items.length,
    );

    return {
      queueId: 'queue_demo',
      mode,
      count: items.length,
      items,
      activeIndex,
      currentTrack: items[activeIndex] ?? null,
      positionMs: state.positionMs ?? 0,
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

  private toQueueState(session: {
    id: string;
    activeIndex: number;
    positionMs: number;
    currentContentItem: PrismaContentItem | null;
    items: Array<{
      contentItem: PrismaContentItem;
    }>;
  }): PlayerQueueStateDto {
    const items = session.items.map((item) =>
      this.contentService.toContentItemDto(item.contentItem),
    );
    const activeIndex = this.clampActiveIndex(session.activeIndex, items.length);
    const currentTrack =
      session.currentContentItem &&
      items.some((item) => item.id === session.currentContentItem?.id)
        ? this.contentService.toContentItemDto(session.currentContentItem)
        : items[activeIndex] ?? null;

    return {
      queueId: session.id,
      count: items.length,
      items,
      activeIndex,
      currentTrack,
      positionMs: session.positionMs,
    };
  }

  private clampActiveIndex(index: number, itemCount: number) {
    if (itemCount === 0) {
      return -1;
    }

    return Math.max(0, Math.min(index, itemCount - 1));
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContextService {
  constructor(private prisma: PrismaService) {}

  async createSnapshot(
    userId: string,
    meta: {
      timezone: string;
      locationText?: string;
      weatherJson?: object;
      taskLabel?: string;
      moodLabel?: string;
    },
  ): Promise<any> {
    const now = new Date();
    const moodLabel =
      meta.moodLabel ?? (await this.deriveMoodFromRecentEvents(userId));

    return this.prisma.contextSnapshot.create({
      data: {
        userId,
        timezone: meta.timezone,
        localTime: now,
        locationText:
          meta.locationText ?? this.locationFromTimezone(meta.timezone),
        taskLabel: meta.taskLabel ?? null,
        moodLabel,
      },
    });
  }

  async getRecentSnapshot(userId: string): Promise<any | null> {
    return this.prisma.contextSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Heuristic mood detection from recent playback
  private async deriveMoodFromRecentEvents(userId: string): Promise<string> {
    const recentEvents = await this.prisma.playbackEvent.findMany({
      where: {
        userId,
        occurredAt: { gte: new Date(Date.now() - 3600000) }, // last hour
      },
      include: { contentItem: true },
      take: 50,
    });

    if (recentEvents.length === 0) return 'neutral';

    const skips = recentEvents.filter((e) => e.eventType === 'SKIPPED').length;
    const skipRate = skips / recentEvents.length;

    if (skipRate > 0.4) return 'restless';

    // Check for instrumental/ambient content patterns
    const tags = recentEvents
      .flatMap((e) => (e.contentItem?.primaryArtistNames as string[]) ?? [])
      .map((t) => t.toLowerCase());

    const instrumentalCount = tags.filter(
      (t) =>
        t.includes('instrumental') ||
        t.includes('ambient') ||
        t.includes('classical'),
    ).length;

    if (instrumentalCount > recentEvents.length * 0.6) return 'focused';
    if (recentEvents.length > 10 && skipRate < 0.1) return 'energetic';

    return 'neutral';
  }

  private locationFromTimezone(timezone: string): string {
    const parts = timezone.split('/');
    return parts[parts.length - 1]?.replace(/_/g, ' ') ?? timezone;
  }
}

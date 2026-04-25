import { Injectable } from '@nestjs/common';
import type {
  TasteProfileDto,
  TasteProfileUpdateResponseDto,
  TasteTagDto,
  UpdateTasteTagsDto,
} from '@music-ai/shared';
import { ContentType, Prisma, SourceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type ProfileState = Prisma.TasteProfileGetPayload<{
  include: { tags: true };
}>;

type TagAccumulator = {
  type: string;
  value: string;
  weight: number;
  isNegative: boolean;
};

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasteReport(userId: string): Promise<TasteProfileDto> {
    const state = await this.getOrCreateProfileState(userId);
    return this.toTasteProfileDto(state);
  }

  async updateTags(
    userId: string,
    input: UpdateTasteTagsDto,
  ): Promise<TasteProfileUpdateResponseDto> {
    const existing = await this.getOrCreateProfileState(userId);
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const update of input.updates) {
        const type = update.type.trim().toLowerCase();
        const value = update.value.trim();

        if (!type || !value) {
          continue;
        }

        const lowerValue = value.toLowerCase();
        if (update.action === 'remove') {
          const removed = await tx.tasteProfileTag.deleteMany({
            where: {
              tasteProfileId: existing.id,
              tagType: type,
              tagValue: lowerValue,
            },
          });
          updated += removed.count;
          continue;
        }

        const nextNegative = update.action === 'decrease';
        await tx.tasteProfileTag.deleteMany({
          where: {
            tasteProfileId: existing.id,
            tagType: type,
            tagValue: lowerValue,
            isNegative: !nextNegative,
          },
        });

        const current = await tx.tasteProfileTag.findFirst({
          where: {
            tasteProfileId: existing.id,
            tagType: type,
            tagValue: lowerValue,
            isNegative: nextNegative,
          },
        });

        if (current) {
          await tx.tasteProfileTag.update({
            where: { id: current.id },
            data: {
              weight: Math.min(current.weight + 0.25, 2),
              sourceType: SourceType.USER,
            },
          });
        } else {
          await tx.tasteProfileTag.create({
            data: {
              tasteProfileId: existing.id,
              tagType: type,
              tagValue: lowerValue,
              weight: 0.65,
              sourceType: SourceType.USER,
              isNegative: nextNegative,
            },
          });
        }

        updated += 1;
      }
    });

    const refreshed = await this.prisma.tasteProfile.findUniqueOrThrow({
      where: { userId },
      include: { tags: true },
    });

    const normalizedTags = refreshed.tags.map((tag) => ({
      type: tag.tagType,
      value: tag.tagValue,
      weight: tag.weight,
      isNegative: tag.isNegative,
    }));
    const summary = this.buildSummary(normalizedTags);
    const explorationLevel = this.deriveExplorationLevel(normalizedTags);
    const familiarityLevel = this.deriveFamiliarityLevel(normalizedTags);

    await this.prisma.$transaction(async (tx) => {
      await tx.tasteProfile.update({
        where: { id: refreshed.id },
        data: {
          summaryText: summary,
          explorationLevel,
          familiarityLevel,
          generatedAt: new Date(),
        },
      });

      await tx.tasteProfileSnapshot.create({
        data: {
          userId,
          tasteProfileId: refreshed.id,
          snapshotJson: this.toSnapshotJson(
            summary,
            explorationLevel,
            normalizedTags,
          ),
        },
      });
    });

    const latest = await this.prisma.tasteProfile.findUniqueOrThrow({
      where: { userId },
      include: { tags: true },
    });

    return {
      updated,
      profile: this.toTasteProfileDto(latest),
    };
  }

  async getOrCreateProfileState(userId: string): Promise<ProfileState> {
    const existing = await this.prisma.tasteProfile.findUnique({
      where: { userId },
      include: { tags: true },
    });
    if (existing) {
      return existing;
    }

    const baseline = await this.buildBaselineProfile(userId);

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.tasteProfile.create({
        data: {
          userId,
          summaryText: baseline.summary,
          explorationLevel: baseline.explorationLevel,
          familiarityLevel: baseline.familiarityLevel,
          generatedAt: new Date(),
        },
      });

      if (baseline.tags.length > 0) {
        await tx.tasteProfileTag.createMany({
          data: baseline.tags.map((tag) => ({
            tasteProfileId: profile.id,
            tagType: tag.type,
            tagValue: tag.value,
            weight: tag.weight,
            sourceType: SourceType.SYSTEM,
            isNegative: tag.isNegative,
          })),
        });
      }

      await tx.tasteProfileSnapshot.create({
        data: {
          userId,
          tasteProfileId: profile.id,
          snapshotJson: this.toSnapshotJson(
            baseline.summary,
            baseline.explorationLevel,
            baseline.tags,
          ),
        },
      });

      return tx.tasteProfile.findUniqueOrThrow({
        where: { id: profile.id },
        include: { tags: true },
      });
    });
  }

  private async buildBaselineProfile(userId: string) {
    const [favorites, playbackEvents, playlistItems] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId, deletedAt: null },
        include: { contentItem: true },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.playbackEvent.findMany({
        where: { userId },
        include: { contentItem: true },
        orderBy: { occurredAt: 'desc' },
        take: 80,
      }),
      this.prisma.playlistItem.findMany({
        where: {
          playlist: {
            userId,
            deletedAt: null,
          },
        },
        include: { contentItem: true },
        orderBy: { createdAt: 'desc' },
        take: 60,
      }),
    ]);

    const positive = new Map<string, TagAccumulator>();
    const negative = new Map<string, TagAccumulator>();

    for (const favorite of favorites) {
      this.bumpTag(
        positive,
        'artist',
        favorite.contentItem.primaryArtistNames,
        0.9,
      );
      this.bumpTag(positive, 'language', favorite.contentItem.language, 0.75);
      this.bumpTag(
        positive,
        'type',
        this.fromContentType(favorite.contentItem.contentType),
        0.65,
      );
      this.bumpTag(positive, 'album', favorite.contentItem.albumName, 0.35);
    }

    for (const item of playlistItems) {
      this.bumpTag(
        positive,
        'artist',
        item.contentItem.primaryArtistNames,
        0.3,
      );
      this.bumpTag(positive, 'language', item.contentItem.language, 0.24);
      this.bumpTag(
        positive,
        'type',
        this.fromContentType(item.contentItem.contentType),
        0.2,
      );
    }

    for (const event of playbackEvents) {
      const multiplier =
        event.eventType === 'PLAY_COMPLETED'
          ? 0.62
          : event.eventType === 'PLAY_STARTED'
            ? 0.22
            : event.eventType === 'SKIPPED'
              ? 0.52
              : 0;
      if (multiplier <= 0) {
        continue;
      }

      const target = event.eventType === 'SKIPPED' ? negative : positive;
      this.bumpTag(
        target,
        'artist',
        event.contentItem.primaryArtistNames,
        multiplier,
      );
      this.bumpTag(
        target,
        'language',
        event.contentItem.language,
        multiplier * 0.7,
      );
      this.bumpTag(
        target,
        'type',
        this.fromContentType(event.contentItem.contentType),
        multiplier * 0.55,
      );
    }

    const tags = [
      ...this.topTags(positive, 8, false),
      ...this.topTags(negative, 4, true),
    ];

    if (tags.length === 0) {
      return {
        summary:
          'Your listening profile is still warming up. Start playing, saving, or queuing tracks and Cusic will shape a clearer lane.',
        explorationLevel: 'low',
        familiarityLevel: 'low',
        tags,
      };
    }

    return {
      summary: this.buildSummary(tags),
      explorationLevel: this.deriveExplorationLevel(tags),
      familiarityLevel: this.deriveFamiliarityLevel(tags),
      tags,
    };
  }

  private toTasteProfileDto(state: ProfileState): TasteProfileDto {
    return {
      summary: state.summaryText,
      explorationLevel: state.explorationLevel,
      tags: state.tags
        .slice()
        .sort((left, right) => right.weight - left.weight)
        .map(
          (tag): TasteTagDto => ({
            type: tag.tagType,
            value: tag.tagValue,
            weight: Number(tag.weight.toFixed(2)),
            isNegative: tag.isNegative,
          }),
        ),
    };
  }

  private toSnapshotJson(
    summary: string,
    explorationLevel: string,
    tags: Array<TasteTagDto | TagAccumulator>,
  ): Prisma.InputJsonObject {
    return {
      summary,
      explorationLevel,
      tags: tags.map((tag) => ({
        type: tag.type,
        value: tag.value,
        weight: Number(tag.weight.toFixed(2)),
        isNegative: tag.isNegative,
      })),
    };
  }

  private buildSummary(
    tags: Array<{ type: string; value: string; isNegative: boolean }>,
  ) {
    const positive = tags.filter((tag) => !tag.isNegative).slice(0, 3);
    const negative = tags.filter((tag) => tag.isNegative).slice(0, 1);

    if (positive.length === 0) {
      return 'Your listening lane is still gathering stronger signals.';
    }

    const positiveText = positive.map((tag) =>
      this.describeTag(tag.type, tag.value),
    );
    const primary = this.joinPhrases(positiveText);
    const negativeText =
      negative.length > 0
        ? ` while easing away from ${this.describeTag(negative[0].type, negative[0].value)}`
        : '';

    return `You currently lean toward ${primary}${negativeText}.`;
  }

  private deriveExplorationLevel(
    tags: Array<{ type: string; value: string; isNegative: boolean }>,
  ) {
    const diversity = new Set(
      tags
        .filter((tag) => !tag.isNegative)
        .map((tag) => `${tag.type}:${tag.value}`),
    ).size;

    if (diversity >= 8) {
      return 'high';
    }
    if (diversity >= 4) {
      return 'medium';
    }
    return 'low';
  }

  private deriveFamiliarityLevel(
    tags: Array<{ weight: number; isNegative: boolean }>,
  ) {
    const positive = tags.filter((tag) => !tag.isNegative);
    if (positive.length === 0) {
      return 'low';
    }

    const strongest = Math.max(...positive.map((tag) => tag.weight));
    if (strongest >= 1.6) {
      return 'high';
    }
    if (strongest >= 0.9) {
      return 'medium';
    }
    return 'low';
  }

  private topTags(
    source: Map<string, TagAccumulator>,
    limit: number,
    isNegative: boolean,
  ) {
    return [...source.values()]
      .sort((left, right) => right.weight - left.weight)
      .slice(0, limit)
      .map((tag) => ({
        ...tag,
        isNegative,
        weight: Number(tag.weight.toFixed(2)),
      }));
  }

  private bumpTag(
    source: Map<string, TagAccumulator>,
    type: string,
    rawValue: string | string[] | null | undefined,
    amount: number,
  ) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        this.bumpTag(source, type, value, amount);
      }
      return;
    }

    const value = rawValue?.trim().toLowerCase();
    if (!value) {
      return;
    }

    const key = `${type}:${value}`;
    const current = source.get(key) ?? {
      type,
      value,
      weight: 0,
      isNegative: false,
    };
    current.weight += amount;
    source.set(key, current);
  }

  private describeTag(type: string, value: string) {
    switch (type) {
      case 'artist':
        return value;
      case 'language':
        return `${value} listening`;
      case 'type':
        return `${value}-leaning sessions`;
      case 'album':
        return `records around ${value}`;
      default:
        return value;
    }
  }

  private joinPhrases(parts: string[]) {
    if (parts.length <= 1) {
      return parts[0] ?? 'a steady listening lane';
    }
    if (parts.length === 2) {
      return `${parts[0]} and ${parts[1]}`;
    }
    return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
  }

  private fromContentType(type: ContentType) {
    switch (type) {
      case ContentType.PODCAST_EPISODE:
        return 'podcast';
      case ContentType.RADIO_STREAM:
        return 'radio';
      case ContentType.ALBUM:
        return 'album';
      case ContentType.TRACK:
      default:
        return 'track';
    }
  }
}

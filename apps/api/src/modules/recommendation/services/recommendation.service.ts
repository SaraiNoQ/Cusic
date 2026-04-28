import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ContentItemDto,
  DailyPlaylistDto,
  NowRecommendationDto,
  RecommendationCardDto,
  RecommendationFeedbackDto,
  RecommendationFeedbackResponseDto,
} from '@music-ai/shared';
import {
  ContentType,
  EventType,
  FeedbackType,
  JobStatus,
  PlaylistType,
  Prisma,
  RecommendationType,
  SourceType,
} from '@prisma/client';
import { ContentService } from '../../content/services/content.service';
import { LlmService } from '../../llm/services/llm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileService } from '../../profile/services/profile.service';

type ZonedStamp = {
  timezone: string;
  localTime: Date;
  hour: number;
  dateKey: string;
  forDate: Date;
};

type RankedCandidate = {
  content: Prisma.ContentItemGetPayload<Record<string, never>>;
  score: number;
  reasons: string[];
};

@Injectable()
export class RecommendationService {
  private readonly demoNowIds = [
    'cnt_afterhours_loop',
    'cnt_canton_midnight',
    'cnt_podcast_brief',
  ];
  private readonly demoDailyIds = [
    'cnt_editorial_dusk',
    'cnt_focus_fm',
    'cnt_canton_midnight',
    'cnt_city_rain',
    'cnt_podcast_brief',
  ];

  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly profileService: ProfileService,
    private readonly llmService: LlmService,
  ) {}

  async getNowRecommendation(
    userId?: string,
    timezoneHeader?: string,
  ): Promise<NowRecommendationDto> {
    const stamp = this.resolveZonedStamp(timezoneHeader);

    if (!userId) {
      return this.getDemoNowRecommendation(stamp.hour);
    }

    const profile = await this.profileService.getOrCreateProfileState(userId);
    const ranked = await this.rankCandidates(userId, profile.tags, stamp.hour);
    const top = ranked.slice(0, 3);
    const explanation = await this.buildRecommendationExplanation(
      profile.tags,
      stamp.hour,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const contextSnapshot = await tx.contextSnapshot.create({
        data: {
          userId,
          timezone: stamp.timezone,
          localTime: stamp.localTime,
        },
      });

      const recommendation = await tx.recommendationResult.create({
        data: {
          userId,
          recommendationType: RecommendationType.NOW,
          contextSnapshotId: contextSnapshot.id,
          tasteProfileId: profile.id,
          explanationText: explanation,
          traceJson: {
            mode: 'rule_v1',
            candidateCount: ranked.length,
            timezone: stamp.timezone,
            hour: stamp.hour,
          },
        },
      });

      if (top.length > 0) {
        await tx.recommendationItem.createMany({
          data: top.map((candidate, index) => ({
            recommendationResultId: recommendation.id,
            contentItemId: candidate.content.id,
            rank: index + 1,
            score: Number(candidate.score.toFixed(4)),
            reasonText: this.compactReason(candidate.reasons),
          })),
        });
      }

      return recommendation;
    });

    return {
      recommendationId: result.id,
      explanation,
      items: top.map((candidate) => this.toRecommendationCardDto(candidate)),
    };
  }

  async getDailyPlaylist(
    userId?: string,
    timezoneHeader?: string,
  ): Promise<DailyPlaylistDto> {
    const stamp = this.resolveZonedStamp(timezoneHeader);

    if (!userId) {
      return this.getDemoDailyPlaylist();
    }

    const existing = await this.prisma.dailyPlaylistJob.findUnique({
      where: {
        userId_forDate: {
          userId,
          forDate: stamp.forDate,
        },
      },
      include: {
        playlist: {
          include: {
            items: {
              orderBy: { position: 'asc' },
              include: { contentItem: true },
            },
          },
        },
      },
    });

    if (existing?.playlist && !existing.playlist.deletedAt) {
      return this.toDailyPlaylistDto(existing.playlist);
    }

    const profile = await this.profileService.getOrCreateProfileState(userId);
    const ranked = await this.rankCandidates(userId, profile.tags, stamp.hour);
    const picks = ranked.slice(0, 5);
    const explanation = await this.buildDailyExplanation(profile.tags, stamp.hour);

    const playlist = await this.prisma.$transaction(async (tx) => {
      const contextSnapshot = await tx.contextSnapshot.create({
        data: {
          userId,
          timezone: stamp.timezone,
          localTime: stamp.localTime,
        },
      });

      const recommendation = await tx.recommendationResult.create({
        data: {
          userId,
          recommendationType: RecommendationType.DAILY,
          contextSnapshotId: contextSnapshot.id,
          tasteProfileId: profile.id,
          explanationText: explanation,
          traceJson: {
            mode: 'daily_rule_v1',
            candidateCount: ranked.length,
            timezone: stamp.timezone,
            dateKey: stamp.dateKey,
          },
        },
      });

      let playlistId = existing?.playlistId ?? null;
      if (!playlistId) {
        const created = await tx.playlist.create({
          data: {
            userId,
            title: 'Today in Cusic',
            description: explanation,
            playlistType: PlaylistType.DAILY,
            sourceType: SourceType.SYSTEM,
            isPinned: true,
            generatedContextJson: {
              dateKey: stamp.dateKey,
              recommendationResultId: recommendation.id,
            },
          },
        });
        playlistId = created.id;
      } else {
        await tx.playlist.update({
          where: { id: playlistId },
          data: {
            title: 'Today in Cusic',
            description: explanation,
            deletedAt: null,
            generatedContextJson: {
              dateKey: stamp.dateKey,
              recommendationResultId: recommendation.id,
            },
          },
        });

        await tx.playlistItem.deleteMany({
          where: { playlistId },
        });
      }

      if (picks.length > 0) {
        await tx.recommendationItem.createMany({
          data: picks.map((candidate, index) => ({
            recommendationResultId: recommendation.id,
            contentItemId: candidate.content.id,
            rank: index + 1,
            score: Number(candidate.score.toFixed(4)),
            reasonText: this.compactReason(candidate.reasons),
          })),
        });

        await tx.playlistItem.createMany({
          data: picks.map((candidate, index) => ({
            playlistId: playlistId!,
            contentItemId: candidate.content.id,
            position: index + 1,
            addedByType: SourceType.SYSTEM,
            reasonText: this.compactReason(candidate.reasons),
          })),
        });
      }

      await tx.dailyPlaylistJob.upsert({
        where: {
          userId_forDate: {
            userId,
            forDate: stamp.forDate,
          },
        },
        create: {
          userId,
          forDate: stamp.forDate,
          jobStatus: JobStatus.SUCCEEDED,
          playlistId,
        },
        update: {
          jobStatus: JobStatus.SUCCEEDED,
          playlistId,
          errorText: null,
        },
      });

      return tx.playlist.findUniqueOrThrow({
        where: { id: playlistId },
        include: {
          items: {
            orderBy: { position: 'asc' },
            include: { contentItem: true },
          },
        },
      });
    });

    return this.toDailyPlaylistDto(playlist);
  }

  async submitFeedback(
    userId: string,
    body: RecommendationFeedbackDto,
  ): Promise<RecommendationFeedbackResponseDto> {
    if (body.recommendationResultId) {
      const recommendation = await this.prisma.recommendationResult.findFirst({
        where: {
          id: body.recommendationResultId,
          userId,
        },
      });

      if (!recommendation) {
        throw new NotFoundException('Recommendation result was not found');
      }
    }

    const feedback = await this.prisma.preferenceFeedback.create({
      data: {
        userId,
        targetType: body.targetType.trim().toLowerCase(),
        targetId: body.targetId.trim(),
        feedbackType: this.toFeedbackType(body.feedbackType),
        recommendationResultId: body.recommendationResultId ?? null,
        reasonText: body.reasonText?.trim() || null,
      },
    });

    return {
      feedbackId: feedback.id,
      recorded: true,
    };
  }

  private async getDemoNowRecommendation(
    hour: number,
  ): Promise<NowRecommendationDto> {
    const ids =
      hour >= 21 || hour < 6
        ? this.demoNowIds
        : ['cnt_morning_wire', 'cnt_editorial_dusk', 'cnt_podcast_brief'];
    const items = await this.contentService.getByIds(ids);

    return {
      recommendationId: 'rec_demo_now',
      explanation:
        hour >= 21 || hour < 6
          ? 'A quieter lane for a late-hour session, mixing soft tracks with one spoken-word option.'
          : 'A steadier daytime lane, balancing focus tracks with one briefing voice.',
      items: items.map((content) => ({
        contentId: content.id,
        title: content.title,
        reason:
          hour >= 21 || hour < 6
            ? 'Fits a softer late-night listening window.'
            : 'Keeps the current desk-side session moving without too much drag.',
        content,
      })),
    };
  }

  private async getDemoDailyPlaylist(): Promise<DailyPlaylistDto> {
    const items = await this.contentService.getByIds(this.demoDailyIds);

    return {
      playlistId: 'daily_demo',
      title: 'Today in Cusic',
      description:
        'A compact daily lane built from the current demo catalog, spanning focus tracks and one spoken segment.',
      itemCount: items.length,
      recommendationResultId: null,
      items,
    };
  }

  private async rankCandidates(
    userId: string,
    tags: Array<{
      tagType: string;
      tagValue: string;
      weight: number;
      isNegative: boolean;
    }>,
    hour: number,
  ) {
    await this.contentService.ensureDemoCatalogSynced();

    const [candidates, favorites, events] = await Promise.all([
      this.prisma.contentItem.findMany({
        where: { playable: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.favorite.findMany({
        where: { userId, deletedAt: null },
        include: { contentItem: true },
      }),
      this.prisma.playbackEvent.findMany({
        where: { userId },
        include: { contentItem: true },
        orderBy: { occurredAt: 'desc' },
        take: 40,
      }),
    ]);

    const positive = new Map<string, number>();
    const negative = new Map<string, number>();
    for (const tag of tags) {
      const key = `${tag.tagType}:${tag.tagValue}`;
      const target = tag.isNegative ? negative : positive;
      target.set(key, (target.get(key) ?? 0) + tag.weight);
    }

    const favoriteIds = new Set(favorites.map((item) => item.contentItemId));
    const recentStarts = new Set(
      events
        .filter(
          (event) =>
            event.eventType === EventType.PLAY_STARTED ||
            event.eventType === EventType.PLAY_COMPLETED,
        )
        .map((event) => event.contentItemId),
    );
    const skippedIds = new Set(
      events
        .filter((event) => event.eventType === EventType.SKIPPED)
        .map((event) => event.contentItemId),
    );

    return candidates
      .map((content): RankedCandidate => {
        let score = 0.12;
        const reasons: string[] = [];

        if (favoriteIds.has(content.id)) {
          score += 1.3;
          reasons.push('It echoes the lane you already saved to favorites.');
        }

        if (recentStarts.has(content.id)) {
          score += 0.55;
          reasons.push(
            'It stays close to the tracks you recently let play through.',
          );
        }

        if (skippedIds.has(content.id)) {
          score -= 0.8;
          reasons.push('Recent skips push it lower in the stack.');
        }

        for (const artist of content.primaryArtistNames) {
          const key = `artist:${artist.toLowerCase()}`;
          const positiveWeight = positive.get(key) ?? 0;
          const negativeWeight = negative.get(key) ?? 0;
          if (positiveWeight > 0) {
            score += positiveWeight * 0.9;
            reasons.push(`You keep returning to ${artist}.`);
          }
          if (negativeWeight > 0) {
            score -= negativeWeight * 0.8;
          }
        }

        const languageKey = content.language
          ? `language:${content.language.toLowerCase()}`
          : null;
        if (languageKey) {
          const positiveWeight = positive.get(languageKey) ?? 0;
          const negativeWeight = negative.get(languageKey) ?? 0;
          if (positiveWeight > 0) {
            score += positiveWeight * 0.75;
            reasons.push(
              `It matches your recent ${content.language} listening lane.`,
            );
          }
          if (negativeWeight > 0) {
            score -= negativeWeight * 0.7;
          }
        }

        const typeValue = this.fromContentType(content.contentType);
        const typeKey = `type:${typeValue}`;
        const typeWeight = positive.get(typeKey) ?? 0;
        const typeNegative = negative.get(typeKey) ?? 0;
        if (typeWeight > 0) {
          score += typeWeight * 0.5;
          reasons.push(
            `It fits the ${typeValue}-heavy sessions in your profile.`,
          );
        }
        if (typeNegative > 0) {
          score -= typeNegative * 0.45;
        }

        if (content.albumName) {
          const albumKey = `album:${content.albumName.toLowerCase()}`;
          const albumWeight = positive.get(albumKey) ?? 0;
          if (albumWeight > 0) {
            score += albumWeight * 0.35;
            reasons.push(
              `It stays close to albums you have already been circling.`,
            );
          }
        }

        if (hour >= 21 || hour < 6) {
          if (content.language?.toLowerCase() === 'instrumental') {
            score += 0.35;
            reasons.push('It sits well inside a quieter late-hour window.');
          }
          if (content.canonicalTitle.toLowerCase().includes('midnight')) {
            score += 0.18;
          }
        } else if (hour >= 6 && hour < 11) {
          if (content.canonicalTitle.toLowerCase().includes('morning')) {
            score += 0.4;
            reasons.push('It carries a lighter morning lift.');
          }
        } else if (hour >= 11 && hour < 18) {
          if (content.contentType === ContentType.PODCAST_EPISODE) {
            score += 0.22;
            reasons.push('A spoken segment can fit a daytime work block.');
          }
        }

        return {
          content,
          score,
          reasons,
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.content.canonicalTitle.localeCompare(
          right.content.canonicalTitle,
        );
      });
  }

  private toRecommendationCardDto(
    candidate: RankedCandidate,
  ): RecommendationCardDto {
    const content = this.contentService.toContentItemDto(candidate.content);

    return {
      contentId: content.id,
      title: content.title,
      reason: this.compactReason(candidate.reasons),
      content,
    };
  }

  private toDailyPlaylistDto(
    playlist: Prisma.PlaylistGetPayload<{
      include: {
        items: {
          include: { contentItem: true };
        };
      };
    }>,
  ): DailyPlaylistDto {
    const generatedContext =
      playlist.generatedContextJson &&
      typeof playlist.generatedContextJson === 'object' &&
      !Array.isArray(playlist.generatedContextJson)
        ? playlist.generatedContextJson
        : {};
    const recommendationResultId =
      'recommendationResultId' in generatedContext &&
      typeof generatedContext.recommendationResultId === 'string'
        ? generatedContext.recommendationResultId
        : null;

    return {
      playlistId: playlist.id,
      title: playlist.title,
      description:
        playlist.description ??
        'A daily sequence shaped from your recent listening signals.',
      itemCount: playlist.items.length,
      recommendationResultId,
      items: playlist.items.map((item) =>
        this.contentService.toContentItemDto(item.contentItem),
      ),
    };
  }

  private compactReason(reasons: string[]) {
    const unique = [...new Set(reasons.filter(Boolean))].slice(0, 2);
    if (unique.length === 0) {
      return 'Balanced against the current signals in your listening lane.';
    }
    return unique.join(' ');
  }

  private async buildRecommendationExplanation(
    tags: Array<{
      tagType: string;
      tagValue: string;
      weight: number;
      isNegative: boolean;
    }>,
    hour: number,
  ): Promise<string> {
    const llmAvailable = await this.llmService.isAvailable();

    if (llmAvailable) {
      try {
        return await this.llmRecommendationExplanation(tags, hour);
      } catch (error) {
        this.logger.warn(`LLM recommendation explanation failed: ${String(error)}`);
      }
    }

    return this.buildRecommendationExplanationFallback(tags, hour);
  }

  private async llmRecommendationExplanation(
    tags: Array<{
      tagType: string;
      tagValue: string;
      weight: number;
      isNegative: boolean;
    }>,
    hour: number,
  ): Promise<string> {
    const segment = this.describeDaySegment(hour);
    const positive = tags
      .filter((tag) => !tag.isNegative)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 3);

    const tagDescriptions = positive
      .map((tag) => `${this.describeTag(tag.tagType, tag.tagValue)} (weight: ${tag.weight.toFixed(2)})`)
      .join(', ');

    const systemPrompt = `You are Cusic's recommendation engine. Generate a natural 1-2 sentence explanation for why specific tracks were recommended.

Context:
- Time of day: ${segment}
- Top user taste tags: ${tagDescriptions || 'new listener, no strong signals yet'}

Write a concise, warm explanation that connects the user's taste profile with the time-of-day context. Do not list tags — weave them into a natural sentence. Reply in English. Return only the explanation text, no JSON wrapper.`;

    return this.llmService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate a brief, warm recommendation explanation.' },
      ],
      {
        temperature: 0.7,
        maxTokens: 256,
        timeoutMs: 5_000,
      },
    );
  }

  private buildRecommendationExplanationFallback(
    tags: Array<{
      tagType: string;
      tagValue: string;
      weight: number;
      isNegative: boolean;
    }>,
    hour: number,
  ) {
    const segment = this.describeDaySegment(hour);
    const topTags = tags
      .filter((tag) => !tag.isNegative)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 2)
      .map((tag) => this.describeTag(tag.tagType, tag.tagValue));

    if (topTags.length === 0) {
      return `Built for your ${segment} window, using the strongest recent signals Cusic has seen so far.`;
    }

    return `Built for your ${segment} window, leaning on ${this.joinPhrases(topTags)} from your recent profile and playback signals.`;
  }

  private async buildDailyExplanation(
    tags: Array<{
      tagType: string;
      tagValue: string;
      weight: number;
      isNegative: boolean;
    }>,
    hour: number,
  ): Promise<string> {
    const llmAvailable = await this.llmService.isAvailable();

    if (llmAvailable) {
      try {
        return await this.llmDailyExplanation(tags, hour);
      } catch (error) {
        this.logger.warn(`LLM daily explanation failed: ${String(error)}`);
      }
    }

    return this.buildDailyExplanationFallback(tags, hour);
  }

  private async llmDailyExplanation(
    tags: Array<{
      tagType: string;
      tagValue: string;
      weight: number;
      isNegative: boolean;
    }>,
    hour: number,
  ): Promise<string> {
    const segment = this.describeDaySegment(hour);
    const positive = tags
      .filter((tag) => !tag.isNegative)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 3);

    const tagDescriptions = positive
      .map((tag) => `${this.describeTag(tag.tagType, tag.tagValue)} (weight: ${tag.weight.toFixed(2)})`)
      .join(', ');

    const systemPrompt = `You are Cusic's daily playlist curator. Generate a natural 1-2 sentence description for a daily playlist tailored to the user.

Context:
- Time of day: ${segment}
- User taste signals: ${tagDescriptions || 'new listener, no strong signals yet'}

Write a warm, inviting description that captures the mood and the listening arc. Mention the time-of-day context naturally. Reply in English. Return only the description text, no JSON wrapper.`;

    return this.llmService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Describe this daily playlist in 1-2 natural sentences.' },
      ],
      {
        temperature: 0.7,
        maxTokens: 256,
        timeoutMs: 5_000,
      },
    );
  }

  private buildDailyExplanationFallback(
    tags: Array<{
      tagType: string;
      tagValue: string;
      weight: number;
      isNegative: boolean;
    }>,
    hour: number,
  ) {
    const segment = this.describeDaySegment(hour);
    const topTags = tags
      .filter((tag) => !tag.isNegative)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 3)
      .map((tag) => this.describeTag(tag.tagType, tag.tagValue));

    if (topTags.length === 0) {
      return `A daily ${segment} sequence shaped from the strongest signals in your current Cusic history.`;
    }

    return `A daily ${segment} sequence shaped around ${this.joinPhrases(topTags)}, with a steady arc instead of a random shuffle.`;
  }

  private toFeedbackType(type: RecommendationFeedbackDto['feedbackType']) {
    switch (type) {
      case 'dislike':
        return FeedbackType.DISLIKE;
      case 'more_like_this':
        return FeedbackType.MORE_LIKE_THIS;
      case 'less_like_this':
        return FeedbackType.LESS_LIKE_THIS;
      case 'like':
      default:
        return FeedbackType.LIKE;
    }
  }

  private resolveZonedStamp(timezoneHeader?: string): ZonedStamp {
    const timezone = this.normalizeTimezone(timezoneHeader);
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(now)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;

    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    const second = Number(parts.second);

    return {
      timezone,
      localTime: new Date(Date.UTC(year, month - 1, day, hour, minute, second)),
      hour,
      dateKey: `${year}-${parts.month}-${parts.day}`,
      forDate: new Date(Date.UTC(year, month - 1, day)),
    };
  }

  private normalizeTimezone(value?: string) {
    const timezone = value?.trim() || 'UTC';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return timezone;
    } catch {
      return 'UTC';
    }
  }

  private describeDaySegment(hour: number) {
    if (hour >= 5 && hour < 11) {
      return 'morning';
    }
    if (hour >= 11 && hour < 18) {
      return 'daytime';
    }
    if (hour >= 18 && hour < 22) {
      return 'evening';
    }
    return 'late-night';
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
    if (parts.length === 0) {
      return 'your recent listening lane';
    }
    if (parts.length === 1) {
      return parts[0];
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

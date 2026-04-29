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
import { EmbeddingService } from '../../content/services/embedding.service';
import { ContextService } from '../../context/context.service';
import { LlmService } from '../../llm/services/llm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VectorSearchService } from '../../prisma/vector-search.service';
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
    private readonly contextService: ContextService,
    private readonly vectorSearchService: VectorSearchService,
    private readonly embeddingService: EmbeddingService,
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

    const contextSnapshot = await this.contextService.createSnapshot(userId, {
      timezone: stamp.timezone,
    });

    const { ranked, vectorCandidateCount } = await this.rankCandidates(
      userId,
      profile.tags,
      stamp.hour,
      contextSnapshot.moodLabel,
    );
    const top = ranked.slice(0, 3);

    // Build explanation and LLM per-item reasons in parallel
    const [explanation, reasonMap] = await Promise.all([
      this.buildRecommendationExplanation(profile.tags, stamp.hour),
      this.generatePerItemReasons(top, profile.tags, {
        moodLabel: contextSnapshot.moodLabel,
        hour: stamp.hour,
      }).catch((error) => {
        this.logger.warn(`LLM per-item reasons failed: ${String(error)}`);
        return new Map<string, string>();
      }),
    ]);

    let llmReasonsUsed = false;
    if (reasonMap.size > 0) {
      for (const item of top) {
        const reason = reasonMap.get(item.content.id);
        if (reason) {
          item.reasons = [reason];
        }
      }
      llmReasonsUsed = true;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const recommendation = await tx.recommendationResult.create({
        data: {
          userId,
          recommendationType: RecommendationType.NOW,
          contextSnapshotId: contextSnapshot.id,
          tasteProfileId: profile.id,
          explanationText: explanation,
          traceJson: {
            mode: 'vector_v1',
            candidateCount: ranked.length,
            vectorCandidatesCount: vectorCandidateCount,
            llmReasonsUsed,
            timezone: stamp.timezone,
            hour: stamp.hour,
            moodLabel: contextSnapshot.moodLabel,
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

    const contextSnapshot = await this.contextService.createSnapshot(userId, {
      timezone: stamp.timezone,
    });

    const { ranked, vectorCandidateCount } = await this.rankCandidates(
      userId,
      profile.tags,
      stamp.hour,
      contextSnapshot.moodLabel,
    );
    const picks = ranked.slice(0, 5);

    // Build explanation and LLM per-item reasons in parallel
    const [explanation, reasonMap] = await Promise.all([
      this.buildDailyExplanation(profile.tags, stamp.hour),
      this.generatePerItemReasons(picks, profile.tags, {
        moodLabel: contextSnapshot.moodLabel,
        hour: stamp.hour,
      }).catch((error) => {
        this.logger.warn(
          `LLM per-item reasons (daily) failed: ${String(error)}`,
        );
        return new Map<string, string>();
      }),
    ]);

    let llmReasonsUsed = false;
    if (reasonMap.size > 0) {
      for (const item of picks) {
        const reason = reasonMap.get(item.content.id);
        if (reason) {
          item.reasons = [reason];
        }
      }
      llmReasonsUsed = true;
    }

    const playlist = await this.prisma.$transaction(async (tx) => {
      const recommendation = await tx.recommendationResult.create({
        data: {
          userId,
          recommendationType: RecommendationType.DAILY,
          contextSnapshotId: contextSnapshot.id,
          tasteProfileId: profile.id,
          explanationText: explanation,
          traceJson: {
            mode: 'vector_v1',
            candidateCount: ranked.length,
            vectorCandidatesCount: vectorCandidateCount,
            llmReasonsUsed,
            timezone: stamp.timezone,
            dateKey: stamp.dateKey,
            moodLabel: contextSnapshot.moodLabel,
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

    const feedbackType = this.toFeedbackType(body.feedbackType);
    const feedback = await this.prisma.preferenceFeedback.create({
      data: {
        userId,
        targetType: body.targetType.trim().toLowerCase(),
        targetId: body.targetId.trim(),
        feedbackType,
        recommendationResultId: body.recommendationResultId ?? null,
        reasonText: body.reasonText?.trim() || null,
      },
    });

    // Feedback-to-embedding loop: nudge taste profile toward/away from content
    if (
      feedbackType === FeedbackType.MORE_LIKE_THIS ||
      feedbackType === FeedbackType.LESS_LIKE_THIS
    ) {
      try {
        await this.nudgeProfileFromFeedback(
          userId,
          body.targetId.trim(),
          feedbackType,
        );
      } catch (error) {
        this.logger.warn(
          `Feedback-to-embedding nudge failed: ${String(error)}`,
        );
      }
    }

    return {
      feedbackId: feedback.id,
      recorded: true,
    };
  }

  /**
   * Nudge the user's taste profile embedding toward or away from a content item.
   */
  private async nudgeProfileFromFeedback(
    userId: string,
    contentItemId: string,
    feedbackType: FeedbackType,
  ): Promise<void> {
    // Fetch content item embedding
    const contentRows = await this.prisma.$queryRaw<
      Array<{ embedding: string }>
    >`
      SELECT embedding::text FROM content_items
      WHERE id = ${contentItemId} AND embedding IS NOT NULL
    `;
    if (contentRows.length === 0 || !contentRows[0].embedding) {
      return;
    }
    const contentEmb = this.parseVectorString(contentRows[0].embedding);

    // Fetch user taste profile embedding
    const profileRows = await this.prisma.$queryRaw<
      Array<{ embedding: string }>
    >`
      SELECT embedding::text FROM taste_profiles
      WHERE user_id = ${userId} AND embedding IS NOT NULL
    `;

    let profileEmb: number[];
    if (profileRows.length > 0 && profileRows[0].embedding) {
      profileEmb = this.parseVectorString(profileRows[0].embedding);
    } else {
      // No profile embedding yet — seed from the content embedding with half weight
      profileEmb = contentEmb.map((v) => v * 0.5);
    }

    // Nudge
    const direction =
      feedbackType === FeedbackType.MORE_LIKE_THIS ? 'toward' : 'away';
    const adjusted = await this.embeddingService.nudgeProfileEmbedding(
      profileEmb,
      contentEmb,
      direction,
      0.05,
    );

    // Update DB
    const vectorStr = `[${adjusted.join(',')}]`;
    await this.prisma.$executeRaw`
      UPDATE taste_profiles SET embedding = ${vectorStr}::vector WHERE user_id = ${userId}
    `;
  }

  /**
   * Parse a pgvector text representation like [0.1,0.2,0.3] into a number array.
   */
  private parseVectorString(str: string): number[] {
    return str
      .replace(/^[[(]\s*/, '')
      .replace(/\s*[\])]$/, '')
      .split(',')
      .map(Number);
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
    moodLabel?: string,
  ): Promise<{ ranked: RankedCandidate[]; vectorCandidateCount: number }> {
    await this.contentService.ensureDemoCatalogSynced();

    // Phase 1: Vector-based candidate recall
    let candidates: Prisma.ContentItemGetPayload<Record<string, never>>[];
    let vectorCandidateCount = 0;

    try {
      const vectorCandidates = await this.recallCandidates(userId);
      if (vectorCandidates && vectorCandidates.length >= 3) {
        candidates = vectorCandidates;
        vectorCandidateCount = vectorCandidates.length;
        this.logger.log(`Vector recall: ${vectorCandidateCount} candidates`);
      } else {
        candidates = await this.prisma.contentItem.findMany({
          where: { playable: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        this.logger.log(
          'Vector recall returned too few candidates, using full catalog',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Vector recall failed, falling back to full catalog: ${String(error)}`,
      );
      candidates = await this.prisma.contentItem.findMany({
        where: { playable: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
    }

    const [favorites, events] = await Promise.all([
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

    const ranked = candidates
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

        if (moodLabel === 'focused') {
          if (content.language?.toLowerCase() === 'instrumental') {
            score += 0.25;
          }
          if (
            content.canonicalTitle.toLowerCase().includes('ambient') ||
            content.canonicalTitle.toLowerCase().includes('classical')
          ) {
            score += 0.2;
            reasons.push('This fits a focused listening session.');
          }
        } else if (moodLabel === 'energetic') {
          if (content.contentType === ContentType.TRACK) {
            score += 0.15;
          }
        } else if (moodLabel === 'restless') {
          if (content.contentType === ContentType.TRACK) {
            score += 0.1;
            reasons.push('A quick track can suit a restless mood.');
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

    return { ranked, vectorCandidateCount };
  }

  /**
   * Vector-based candidate recall using user taste profile embedding.
   * Falls back to returning an empty array on any error.
   */
  private async recallCandidates(
    userId: string,
  ): Promise<Prisma.ContentItemGetPayload<Record<string, never>>[]> {
    try {
      const profile = await this.prisma.tasteProfile.findUnique({
        where: { userId },
        include: { tags: true },
      });

      if (!profile || profile.tags.length === 0) {
        return [];
      }

      // Build tag description from positive tags, weighted
      const positiveTags = profile.tags
        .filter((t) => !t.isNegative)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 12);

      if (positiveTags.length === 0) {
        return [];
      }

      const tagText = positiveTags
        .map((t) => `${t.tagType}:${t.tagValue}`)
        .join(', ');

      // Embed the taste profile text
      const embeddings = await this.llmService.embed([tagText]);
      const tasteEmbedding = embeddings[0];

      // Vector search for similar content
      const results = await this.vectorSearchService.searchSimilarContent(
        tasteEmbedding,
        50,
      );

      if (results.length === 0) {
        return [];
      }

      // Fetch full ContentItem objects in vector order
      const ids = results.map((r) => r.id as string);
      const contentItems = await this.prisma.contentItem.findMany({
        where: { id: { in: ids }, playable: true },
      });

      const itemMap = new Map(contentItems.map((item) => [item.id, item]));
      const ordered = ids
        .map((id) => itemMap.get(id))
        .filter(
          (item): item is Prisma.ContentItemGetPayload<Record<string, never>> =>
            !!item,
        );

      return ordered;
    } catch (error) {
      this.logger.warn(`recallCandidates failed: ${String(error)}`);
      return [];
    }
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

  /**
   * Generate per-item recommendation reasons via LLM.
   * Returns a Map of contentId → reason (Chinese, 10 chars max).
   * Falls back to empty Map on any error, so callers use compactReason.
   */
  private async generatePerItemReasons(
    items: RankedCandidate[],
    userTags: Array<{
      tagType: string;
      tagValue: string;
      weight: number;
      isNegative: boolean;
    }>,
    context: { moodLabel?: string; hour: number },
  ): Promise<Map<string, string>> {
    if (items.length === 0) {
      return new Map();
    }

    const llmAvailable = await this.llmService.isAvailable();
    if (!llmAvailable) {
      return new Map();
    }

    try {
      const positive = userTags
        .filter((t) => !t.isNegative)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8);

      const tagLines =
        positive.length > 0
          ? positive.map((t) => `- ${t.tagType}: ${t.tagValue}`).join('\n')
          : '新用户，尚无明确偏好';

      const segment = this.describeDaySegment(context.hour);
      const moodText = context.moodLabel || '未知';

      const itemLines = items
        .map((item) => {
          const content = item.content;
          const tags = this.extractContentTags(content);
          const tagStr = tags.length > 0 ? ` | 标签: ${tags.join(', ')}` : '';
          return `${content.id} | ${content.canonicalTitle} | 艺术家: ${content.primaryArtistNames.join(', ')}${tagStr}`;
        })
        .join('\n');

      const systemPrompt = `你是一个音乐推荐引擎。为以下每首推荐曲目写一句简短推荐理由（10个字以内），说明为什么适合用户在此刻收听。只返回合法JSON，不要其他文本。`;

      const userPrompt = `用户偏好：
${tagLines}

当前情境：${segment}，心情${moodText}

候选曲目：
${itemLines}

请为每首曲目生成简短推荐理由，返回JSON格式：{"contentId": "理由"}`;

      const response = await this.llmService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.5,
          maxTokens: 512,
          timeoutMs: 8_000,
        },
      );

      // Parse JSON from response (handle markdown code fences)
      const cleaned = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      const map = new Map<string, string>();
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value.length > 0) {
          map.set(key, value);
        }
      }
      return map;
    } catch (error) {
      this.logger.warn(
        `LLM per-item reasons generation failed: ${String(error)}`,
      );
      return new Map();
    }
  }

  /**
   * Extract genre/style/mood tags from a content item's metadata.
   */
  private extractContentTags(
    content: Prisma.ContentItemGetPayload<Record<string, never>>,
  ): string[] {
    const meta = content.metadataJson;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const tagFields = ['genres', 'styles', 'moods', 'tags'];
      const tags: string[] = [];
      for (const field of tagFields) {
        const val = (meta as Record<string, unknown>)[field];
        if (Array.isArray(val)) {
          tags.push(
            ...(val as unknown[]).filter(
              (t): t is string => typeof t === 'string',
            ),
          );
        }
      }
      return tags;
    }
    return [];
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
        this.logger.warn(
          `LLM recommendation explanation failed: ${String(error)}`,
        );
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
      .map(
        (tag) =>
          `${this.describeTag(tag.tagType, tag.tagValue)} (weight: ${tag.weight.toFixed(2)})`,
      )
      .join(', ');

    const systemPrompt = `You are Cusic's recommendation engine. Generate a natural 1-2 sentence explanation for why specific tracks were recommended.

Context:
- Time of day: ${segment}
- Top user taste tags: ${tagDescriptions || 'new listener, no strong signals yet'}

Write a concise, warm explanation that connects the user's taste profile with the time-of-day context. Do not list tags — weave them into a natural sentence. Reply in English. Return only the explanation text, no JSON wrapper.`;

    return this.llmService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: 'Generate a brief, warm recommendation explanation.',
        },
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
      .map(
        (tag) =>
          `${this.describeTag(tag.tagType, tag.tagValue)} (weight: ${tag.weight.toFixed(2)})`,
      )
      .join(', ');

    const systemPrompt = `You are Cusic's daily playlist curator. Generate a natural 1-2 sentence description for a daily playlist tailored to the user.

Context:
- Time of day: ${segment}
- User taste signals: ${tagDescriptions || 'new listener, no strong signals yet'}

Write a warm, inviting description that captures the mood and the listening arc. Mention the time-of-day context naturally. Reply in English. Return only the description text, no JSON wrapper.`;

    return this.llmService.chat(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: 'Describe this daily playlist in 1-2 natural sentences.',
        },
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

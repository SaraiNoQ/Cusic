import { Injectable, Logger } from '@nestjs/common';
import { ContentType } from '@prisma/client';
import type {
  KnowledgeQueryResponseDto,
  KnowledgeSourceDto,
  KnowledgeTraceDto,
  RelatedContentDto,
} from '@music-ai/shared';
import { LlmService } from '../llm/services/llm.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
  ) {}

  async query(
    userId: string,
    chatSessionId: string | null,
    question: string,
  ): Promise<KnowledgeQueryResponseDto> {
    // 1. Search content catalog for relevant artists/topics
    const catalogMatches = await this.searchContentCatalog(question);

    // 2. Build LLM prompt with catalog context
    const prompt = this.buildKnowledgePrompt(question, catalogMatches);

    // 3. Call LLM
    let reply: string;
    try {
      reply = await this.llmService.chat(
        [
          {
            role: 'system',
            content: '你是一位音乐知识讲解专家。请用中文回答用户的问题。',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7, maxTokens: 1024 },
      );
    } catch (error) {
      this.logger.warn(
        `LLM knowledge query failed, using fallback: ${String(error)}`,
      );
      reply = '抱歉，暂时无法回答音乐知识相关的问题，请稍后再试。';
    }

    // 4. Persist KnowledgeTrace and KnowledgeSources
    const sourceCount = Math.min(catalogMatches.length, 5);
    const trace = await this.prisma.knowledgeTrace.create({
      data: {
        userId,
        chatSessionId,
        queryText: question,
        summaryText: reply,
        sourceCount,
        sources: {
          create: catalogMatches.slice(0, 5).map((item) => ({
            sourceUrl: `content://${item.id}`,
            sourceTitle: item.canonicalTitle,
            snippetText: `${(item.primaryArtistNames ?? []).join(', ') || 'Unknown'} — ${item.canonicalTitle}`,
          })),
        },
      },
      include: { sources: true },
    });

    return {
      traceId: trace.id,
      summaryText: reply,
      sources: trace.sources.map(
        (s): KnowledgeSourceDto => ({
          sourceId: s.id,
          title: s.sourceTitle,
          snippet: s.snippetText ?? '',
          url: s.sourceUrl,
        }),
      ),
      relatedContent: catalogMatches.slice(0, 5).map(
        (item): RelatedContentDto => ({
          contentId: item.id,
          title: item.canonicalTitle,
          artist: (item.primaryArtistNames ?? []).join(', ') || 'Unknown',
          type: this.prismaContentTypeToDto(item.contentType),
        }),
      ),
    };
  }

  private async searchContentCatalog(question: string) {
    // Extract potential artist names / keywords from question
    const keywords = question
      .split(/[\s,，。？?！!]+/)
      .filter((k) => k.length > 1);
    if (keywords.length === 0) return [];

    return this.prisma.contentItem.findMany({
      where: {
        playable: true,
        OR: keywords.flatMap((kw) => [
          { canonicalTitle: { contains: kw, mode: 'insensitive' } },
          { primaryArtistNames: { has: kw } },
        ]),
      },
      take: 10,
    });
  }

  private buildKnowledgePrompt(
    question: string,
    catalogMatches: Array<{
      primaryArtistNames: string[];
      canonicalTitle: string;
      contentType: ContentType;
    }>,
  ): string {
    let contextBlock = '';
    if (catalogMatches.length > 0) {
      contextBlock =
        '\n\n可参考的音乐库资料：\n' +
        catalogMatches
          .map(
            (m) =>
              `- ${(m.primaryArtistNames ?? []).join(', ') || 'Unknown'} — ${m.canonicalTitle} (${this.prismaContentTypeToDto(m.contentType)})`,
          )
          .join('\n');
    }
    return `你是一位音乐知识讲解专家。请用中文回答用户的问题。${contextBlock}\n\n用户问题：${question}`;
  }

  async getTraces(userId: string): Promise<KnowledgeTraceDto[]> {
    const traces = await this.prisma.knowledgeTrace.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return traces.map(
      (t): KnowledgeTraceDto => ({
        id: t.id,
        question: t.queryText,
        summaryText: t.summaryText,
        sourceCount: t.sourceCount,
        createdAt: t.createdAt.toISOString(),
      }),
    );
  }

  async getTrace(traceId: string): Promise<KnowledgeQueryResponseDto | null> {
    const trace = await this.prisma.knowledgeTrace.findUnique({
      where: { id: traceId },
      include: { sources: true },
    });

    if (!trace) {
      return null;
    }

    return {
      traceId: trace.id,
      summaryText: trace.summaryText,
      sources: trace.sources.map(
        (s): KnowledgeSourceDto => ({
          sourceId: s.id,
          title: s.sourceTitle,
          snippet: s.snippetText ?? '',
          url: s.sourceUrl,
        }),
      ),
      relatedContent: [],
    };
  }

  private prismaContentTypeToDto(type: ContentType): string {
    switch (type) {
      case 'PODCAST_EPISODE':
        return 'podcast';
      case 'RADIO_STREAM':
        return 'radio';
      case 'ALBUM':
        return 'album';
      case 'TRACK':
      default:
        return 'track';
    }
  }
}

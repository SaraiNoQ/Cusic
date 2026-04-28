import { Injectable, Logger } from '@nestjs/common';
import type { AiDjIntent, AiDjActionDto } from '@music-ai/shared';
import { LlmService } from '../../llm/services/llm.service';

export interface ReplyContext {
  message: string;
  intent: AiDjIntent;
  contentIds: string[];
  trackDescriptions: string;
  tasteProfileSummary?: string;
  timeOfDay?: string;
  currentTrackTitle?: string;
  currentTrackLanguage?: string;
}

@Injectable()
export class ReplyGeneratorService {
  private readonly logger = new Logger(ReplyGeneratorService.name);

  constructor(private readonly llmService: LlmService) {}

  async generateReply(context: ReplyContext): Promise<string> {
    const llmAvailable = await this.llmService.isAvailable();

    if (llmAvailable) {
      try {
        return await this.llmGenerate(context);
      } catch (error) {
        this.logger.warn(`LLM reply generation failed, using fallback: ${String(error)}`);
      }
    }

    return this.fallbackGenerate(context);
  }

  async generateStreamReply(
    context: ReplyContext,
    onChunk: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const llmAvailable = await this.llmService.isAvailable();

    if (llmAvailable) {
      try {
        return await this.llmStreamGenerate(context, onChunk, signal);
      } catch (error) {
        this.logger.warn(`LLM stream reply failed, using fallback: ${String(error)}`);
      }
    }

    const fallback = this.fallbackGenerate(context);
    const chars = this.chunkText(fallback);
    for (const char of chars) {
      if (signal?.aborted) {
        break;
      }
      onChunk(char);
    }

    return fallback;
  }

  private async llmGenerate(context: ReplyContext): Promise<string> {
    const { systemPrompt, userMessage } = this.buildPrompt(context);

    return this.llmService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        temperature: 0.8,
        maxTokens: 1024,
        timeoutMs: 20_000,
      },
    );
  }

  private async llmStreamGenerate(
    context: ReplyContext,
    onChunk: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const { systemPrompt, userMessage } = this.buildPrompt(context);

    return this.llmService.streamChat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      onChunk,
      {
        temperature: 0.8,
        maxTokens: 1024,
        signal,
        timeoutMs: 30_000,
      },
    );
  }

  private buildPrompt(context: ReplyContext): {
    systemPrompt: string;
    userMessage: string;
  } {
    const intentDescriptions: Record<AiDjIntent, string> = {
      queue_replace:
        'The user wants to switch to new music. Suggest the selected tracks naturally.',
      queue_append:
        'The user wants to add more tracks. Mention how these complement the current queue.',
      recommend_explain:
        'The user wants to understand why something was recommended. Explain the musical reasoning.',
      theme_playlist_preview:
        'The user wants a themed playlist. Paint a vivid picture of the mood and explain why these tracks fit together.',
    };

    const systemPrompt = `You are Cusic's AI DJ, a warm, knowledgeable music companion. Your tone is conversational like a real radio DJ — friendly, insightful, and never robotic.

Guidelines:
- Reply in the same language as the user's message (Chinese or English).
- Keep it 2-4 sentences, concise and natural.
- ${intentDescriptions[context.intent]}
- If tracks were selected, naturally reference them — mention what makes them fit the user's request.
- Never make up track metadata beyond what is provided.
- End with an open-ended invitation to refine or explore further if appropriate.
- Avoid robotic phrases like "based on your request" or "I have selected the following tracks".`;

    const userMessage = [
      `User message: "${context.message}"`,
      `Detected intent: ${context.intent}`,
      context.trackDescriptions
        ? `Selected tracks:\n${context.trackDescriptions}`
        : '',
      context.currentTrackTitle
        ? `Currently playing: ${context.currentTrackTitle}${context.currentTrackLanguage ? ` (${context.currentTrackLanguage})` : ''}`
        : '',
      context.tasteProfileSummary
        ? `User taste profile: ${context.tasteProfileSummary}`
        : '',
      context.timeOfDay ? `Time of day: ${context.timeOfDay}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { systemPrompt, userMessage };
  }

  fallbackGenerate(context: ReplyContext): string {
    const { intent, contentIds } = context;

    switch (intent) {
      case 'queue_append':
        return contentIds.length > 0
          ? '我在当前队列后面补两段相近但不抢戏的内容，让这条听感线继续往前走。'
          : '这轮我没有找到适合继续追加的内容，先保持当前队列不动。';

      case 'recommend_explain': {
        if (context.currentTrackTitle) {
          const languageCue =
            context.currentTrackLanguage === 'zh'
              ? '中文声线把夜色拉近'
              : context.currentTrackLanguage === 'instrumental'
                ? '没有人声会让专注区更稳定'
                : '英文词面留白更多，适合做背景而不抢注意力';

          return `这首 ${context.currentTrackTitle} 现在成立，主要是因为它的速度和密度都比较克制，${languageCue}。如果你想，我下一轮可以按它继续往更冷、更亮或者更城市化的方向扩。`;
        }
        return '这轮推荐的逻辑更偏向当前时间段和你最近的收听走向，所以我会优先给出稳定、可连续播放的内容，而不是一次性把探索幅度拉得太大。';
      }

      case 'theme_playlist_preview':
        return contentIds.length > 0
          ? '我先把这个主题压成一组可直接上机的预览队列，你先听走向，再决定要不要继续扩写。'
          : '这轮主题还不够清晰，我先保留当前频道。你可以补一句语种、场景或时间段。';

      case 'queue_replace':
      default:
        return contentIds.length > 0
          ? '收到。我把主频道切到更贴近你这句指令的航线，先用三段内容把新的听感重心立住。'
          : '我还没锁定足够明确的方向，先不动当前队列。你可以再补一句语种、场景或风格。';
    }
  }

  private chunkText(text: string): string[] {
    if (!text) {
      return [];
    }

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      const nextSlice = text.slice(cursor, cursor + 4);
      chunks.push(nextSlice);
      cursor += nextSlice.length;
    }

    return chunks;
  }
}

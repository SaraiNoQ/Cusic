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
        this.logger.warn(
          `LLM reply generation failed, using fallback: ${String(error)}`,
        );
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
        this.logger.warn(
          `LLM stream reply failed, using fallback: ${String(error)}`,
        );
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
      conversation:
        'The user is chatting casually or asking a question. Respond helpfully as a knowledgeable music companion — answer their question, share musical insight, or offer suggestions. Do NOT act like you have already queued or changed anything. You can suggest songs or directions, but always invite the user to confirm before taking action.',
      queue_replace:
        'The user wants to switch to new music. Suggest the selected tracks naturally.',
      queue_append:
        'The user wants to add more tracks. Mention how these complement the current queue.',
      recommend_explain:
        'The user wants to understand why something was recommended. Explain the musical reasoning.',
      theme_playlist_preview:
        'The user wants a themed playlist. Paint a vivid picture of the mood and explain why these tracks fit together.',
      knowledge_query:
        "The user is asking about music knowledge — artist backgrounds, genre history, song stories, or music theory. Provide an informative, well-structured answer. Reference the tracks in the user's music library if relevant. Be conversational but factual.",
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
      case 'conversation':
        return this.fallbackConversation(context);

      case 'queue_append':
        return contentIds.length > 0
          ? '我在当前队列后面补两段相近但不抢戏的内容，让这条听感线继续往前走。'
          : '这轮我没有找到适合继续追加的内容，先保持当前队列不动。你可以再给我一点风格或语种的线索。';

      case 'recommend_explain': {
        if (context.currentTrackTitle) {
          const langCue =
            context.currentTrackLanguage === 'zh'
              ? '中文声线把夜色拉近'
              : context.currentTrackLanguage === 'instrumental'
                ? '没有人声会让专注区更稳定'
                : '英文词面留白更多，适合做背景而不抢注意力';

          return `这首 ${context.currentTrackTitle} 现在成立，主要是因为它的速度和密度都比较克制，${langCue}。如果你想，我下一轮可以按它继续往更冷、更亮或者更城市化的方向扩。`;
        }
        return '这轮推荐的逻辑更偏向当前时间段和你最近的收听走向，所以我会优先给出稳定、可连续播放的内容，而不是一次性把探索幅度拉得太大。';
      }

      case 'theme_playlist_preview':
        return contentIds.length > 0
          ? '我先把这个主题压成一组可直接上机的预览队列，你先听走向，再决定要不要继续扩写。'
          : '这轮主题还不够清晰，我先保留当前频道。你可以补一句语种、场景或时间段，我再帮你捏合。';

      case 'knowledge_query':
        return '这是一个有意思的问题。虽然我现在没法做完整的知识检索，但你可以试试用「放一首 + 风格」来调整播放，或者稍等片刻后重新问我。';

      case 'queue_replace':
      default:
        return contentIds.length > 0
          ? '收到。我把主频道切到更贴近你这句指令的航线，先用三段内容把新的听感重心立住。'
          : '我还没锁定足够明确的方向，先不动当前队列。你可以再补一句语种、场景或风格，比如「来点粤语」「放首爵士」或者「换个安静的」。';
    }
  }

  private fallbackConversation(context: ReplyContext): string {
    const msg = context.message ?? '';

    // Detect what kind of conversation the user is trying to have
    const isGreeting = /^(hi|hello|hey|你好|嗨|哈喽|早|晚上好|下午好)\b/i.test(
      msg.trim(),
    );
    const isAskingAboutCapability =
      /你能|你会|你可以|can you|what can you|你.*做什么|你.*功能/i.test(msg);
    const isAskingForRec =
      /推荐|recommend|建议|suggest|有什么|what.*(song|music|track|listen)|好听的/i.test(
        msg,
      );
    const isAskingAboutMood = /心情|mood|氛围|vibe|适合|场景|scene|场合/i.test(
      msg,
    );
    const isAskingAboutGenre =
      /genre|风格|流派|类型|type of music|jazz|rock|classical|电子|民谣/i.test(
        msg,
      );
    const isAskingAboutArtist = /artist|歌手|艺人|谁.*唱|who.*sing|乐队/i.test(
      msg,
    );

    if (isGreeting) {
      const timeGreeting = context.timeOfDay?.includes('morning')
        ? '早上好'
        : context.timeOfDay?.includes('night')
          ? '晚上好'
          : '你好';

      return `${timeGreeting}！我是 Cusic，你的 AI DJ 伙伴。你可以直接跟我说「来一首」「换个风格」「做个歌单」，或者在当前播放时问我关于音乐的问题。想从哪里开始？`;
    }

    if (isAskingAboutCapability) {
      return '你可以直接跟我说「来一首 + 风格」点歌、「换歌」切换播放、「做个歌单」整理合集，或者在播放时问我关于音乐背景的问题。我也支持语音输入，按住麦克风按钮就行。试试看？';
    }

    if (isAskingForRec) {
      return '我完全理解你想要发掘新声音的心情。你可以用「来一首 + 风格/语种/场景」这样的指令直接点歌（比如「来首粤语」「放点爵士」），也可以说「做个歌单」让我帮你整理一个主题合集。你有偏好的方向吗？';
    }

    if (isAskingAboutMood || isAskingAboutGenre) {
      return '好品味！不同的风格和氛围确实能让听感完全不同。你可以直接用「来一首 + 你想要的感觉」点歌，比如「来点放松的」「放首摇滚」或者「换个安静的」。想试试哪个方向？';
    }

    if (isAskingAboutArtist) {
      return '关于艺人和乐队的详细信息，我建议你直接用「来一首 + 艺人/风格」点歌先听听感觉，或者用搜索功能查找。如果你想知道为什么推荐了某首歌，随时问我「为什么推荐这个」。';
    }

    // Default conversation fallback — warm, inviting, and nudges toward action
    return '我听到了你的想法。作为你的 AI DJ，我可以帮你点歌、切歌、建歌单，或者解释为什么推荐了某首歌。你可以直接用指令试试看，比如「来一首爵士」「换个风格」或者「做个歌单」。有什么想听的吗？';
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

import { Injectable, Logger } from '@nestjs/common';
import type { AiDjIntent } from '@music-ai/shared';
import { LlmService } from '../../llm/services/llm.service';

@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  constructor(private readonly llmService: LlmService) {}

  async classify(
    message: string,
    contextHint?: string,
  ): Promise<AiDjIntent> {
    const llmAvailable = await this.llmService.isAvailable();

    if (llmAvailable) {
      try {
        return await this.llmClassify(message, contextHint);
      } catch (error) {
        this.logger.warn(`LLM intent classification failed, using fallback: ${String(error)}`);
      }
    }

    return this.fallbackClassify(message);
  }

  private async llmClassify(
    message: string,
    contextHint?: string,
  ): Promise<AiDjIntent> {
    const systemPrompt = `You are an intent classifier for Cusic, a music AI DJ application. Analyze the user's message and classify it into exactly one of these intents:

- "recommend_explain": Asking why something was recommended, seeking explanation about the current track or playlist choices, wanting to understand the reasoning.
- "queue_append": Wanting to add more tracks, requesting more of similar style, appending to the current queue, asking for additional content.
- "theme_playlist_preview": Requesting a themed collection, asking for a curated playlist around a mood/genre/time, generating a specific set of tracks, asking for a playlist.
- "queue_replace": Wanting to change the music completely, switching genres, playing something different, a fresh start, a new direction.

Return ONLY a valid JSON object: {"intent": "<intent>", "confidence": <0.0-1.0>}`;

    const userMessage = contextHint
      ? `Context hint: ${contextHint}\n\nUser message: ${message}`
      : `User message: ${message}`;

    const result = await this.llmService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        temperature: 0.1,
        maxTokens: 100,
        responseFormat: { type: 'json_object' },
        timeoutMs: 5_000,
      },
    );

    const parsed = JSON.parse(result.trim()) as {
      intent: string;
      confidence: number;
    };

    const intent = parsed.intent;
    if (
      intent === 'queue_replace' ||
      intent === 'queue_append' ||
      intent === 'recommend_explain' ||
      intent === 'theme_playlist_preview'
    ) {
      return intent;
    }

    return 'queue_replace';
  }

  fallbackClassify(normalizedMessage: string): AiDjIntent {
    if (
      normalizedMessage.includes('为什么') ||
      normalizedMessage.includes('why') ||
      normalizedMessage.includes('解释') ||
      normalizedMessage.includes('背后')
    ) {
      return 'recommend_explain';
    }

    if (
      normalizedMessage.includes('加') ||
      normalizedMessage.includes('再来') ||
      normalizedMessage.includes('append') ||
      normalizedMessage.includes('补')
    ) {
      return 'queue_append';
    }

    if (
      normalizedMessage.includes('歌单') ||
      normalizedMessage.includes('playlist') ||
      normalizedMessage.includes('来几首') ||
      normalizedMessage.includes('一组') ||
      normalizedMessage.includes('做一份')
    ) {
      return 'theme_playlist_preview';
    }

    return 'queue_replace';
  }
}

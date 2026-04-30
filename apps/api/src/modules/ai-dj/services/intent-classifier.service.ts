import { Injectable, Logger } from '@nestjs/common';
import type { AiDjIntent } from '@music-ai/shared';
import { LlmService } from '../../llm/services/llm.service';
import { getRequestId } from '../../../common/request-id';

@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  constructor(private readonly llmService: LlmService) {}

  async classify(message: string, contextHint?: string): Promise<AiDjIntent> {
    const llmAvailable = await this.llmService.isAvailable();

    if (llmAvailable) {
      try {
        return await this.llmClassify(message, contextHint);
      } catch (error) {
        this.logger.warn(
          `[${getRequestId()}] LLM intent classification failed, using fallback: ${String(error)}`,
        );
      }
    }

    return this.fallbackClassify(message);
  }

  private async llmClassify(
    message: string,
    contextHint?: string,
  ): Promise<AiDjIntent> {
    const systemPrompt = `You are an intent classifier for Cusic, a music AI DJ app. Classify the user message into EXACTLY ONE of these six valid intents. Do NOT invent new intent names.

VALID INTENTS (use only these exact strings):
1. "queue_replace" — User wants to CHANGE/SWITCH what's playing now. Chinese cues: 来一首、来几首、来首、放一首、放几首、播一首、播几首、换一首、换几首、切歌、换歌、放点、来点、来点别的、换一种、放个. English cues: "play", "put on", "switch to", "change the music", "I want to hear", "give me [a/some] song".

2. "queue_append" — User wants to ADD more tracks to existing queue. Chinese cues: 加一首、加几首、再来一首、再来几首、补一首、补几首、多来点、追加. English cues: "add", "append", "more like this", "another one".

3. "theme_playlist_preview" — User wants a CURATED PLAYLIST or collection built. Chinese cues: 歌单、做个歌单、做一份、做张、建一个、推荐一个歌单. English cues: "playlist", "build a list", "curate".

4. "recommend_explain" — User asks WHY something was recommended or seeks explanation. Chinese cues: 为什么推、为什么推荐、解释、背后逻辑. English cues: "why", "explain", "reason".

5. "knowledge_query" — User asks about music knowledge, artist backgrounds, genre history, song stories, music theory. Chinese cues: 介绍、背景、历史、故事、流派、风格、知识、什么是、谁写的、什么时候出的. English cues: "tell me about", "who is", "history of", "what genre", "background", "story behind", "music knowledge".

6. "conversation" — Everything else: casual chat, general questions, asking for suggestions/recommendations WITHOUT explicitly asking to play/queue music. If the user asks "推荐" or "recommend" or "有什么好听的" but does NOT say "来/放/播/play", use "conversation".

Output ONLY a single line of JSON, no markdown, no code fences, no extra commentary:
{"intent":"<one of the six valid intent strings>","confidence":<0.0-1.0>}`;

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
        timeoutMs: 8_000,
      },
    );

    const intent = this.extractIntentFromLlmOutput(result, message);
    return intent;
  }

  private extractIntentFromLlmOutput(
    raw: string,
    _message: string,
  ): AiDjIntent {
    let jsonText = raw.trim();

    // Strip markdown code fences
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonText = fenceMatch[1].trim();
    }

    // Extract outermost braces
    const braceStart = jsonText.indexOf('{');
    const braceEnd = jsonText.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      jsonText = jsonText.slice(braceStart, braceEnd + 1);
    }

    // Try standard parse
    try {
      const parsed = JSON.parse(jsonText) as {
        intent?: string;
        confidence?: number;
      };
      if (this.isValidIntent(parsed.intent)) {
        return parsed.intent;
      }
      if (parsed.intent) {
        this.logger.warn(
          `[${getRequestId()}] LLM returned non-standard intent: "${parsed.intent}", attempting mapping`,
        );
      }
    } catch {
      // fall through to regex extraction
    }

    // Last resort: regex extract intent value (any string)
    const intentMatch = jsonText.match(/"intent"\s*:\s*"([^"]+)"/);
    if (intentMatch) {
      const mapped = this.mapToValidIntent(intentMatch[1]);
      if (mapped) {
        return mapped;
      }
    }

    return 'conversation';
  }

  private mapToValidIntent(raw: string): AiDjIntent | null {
    const normalized = raw.toLowerCase().trim();

    // Direct match
    if (this.isValidIntent(normalized)) {
      return normalized;
    }

    // Map common LLM-invented intents to valid ones
    const replacePatterns = [
      /play|来|放|播|切换|切|change|switch/i,
      /推荐.*歌单|歌单|playlist|curate|build/i,
      /加|补|append|add|再来|多来/i,
      /为什么|解释|explain|reason|背后/i,
      /介绍|背景|历史|故事|流派|知识|什么是|谁写的|genre|history|background|story/i,
      /推荐|recommend|suggest|有什么|what.*(song|music|track|listen)/i,
    ];

    if (replacePatterns[0].test(normalized)) return 'queue_replace';
    if (replacePatterns[1].test(normalized)) return 'theme_playlist_preview';
    if (replacePatterns[2].test(normalized)) return 'queue_append';
    if (replacePatterns[3].test(normalized)) return 'recommend_explain';
    if (replacePatterns[4].test(normalized)) return 'knowledge_query';
    if (replacePatterns[5].test(normalized)) return 'conversation';

    return null;
  }

  private isValidIntent(value: unknown): value is AiDjIntent {
    return (
      value === 'conversation' ||
      value === 'queue_replace' ||
      value === 'queue_append' ||
      value === 'recommend_explain' ||
      value === 'theme_playlist_preview' ||
      value === 'knowledge_query'
    );
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
      normalizedMessage.includes('加一首') ||
      normalizedMessage.includes('加几首') ||
      normalizedMessage.includes('再来一首') ||
      normalizedMessage.includes('再来几首') ||
      normalizedMessage.includes('补一首') ||
      normalizedMessage.includes('补几首') ||
      normalizedMessage.includes('append') ||
      normalizedMessage.includes('多来点')
    ) {
      return 'queue_append';
    }

    if (
      normalizedMessage.includes('歌单') ||
      normalizedMessage.includes('playlist') ||
      normalizedMessage.includes('做一份') ||
      normalizedMessage.includes('做张') ||
      normalizedMessage.includes('建一个')
    ) {
      return 'theme_playlist_preview';
    }

    if (
      normalizedMessage.includes('换一首') ||
      normalizedMessage.includes('换几首') ||
      normalizedMessage.includes('切歌') ||
      normalizedMessage.includes('换歌') ||
      normalizedMessage.includes('replace') ||
      normalizedMessage.includes('换点') ||
      normalizedMessage.includes('放点') ||
      normalizedMessage.includes('来点别的') ||
      normalizedMessage.includes('换一种')
    ) {
      return 'queue_replace';
    }

    if (
      normalizedMessage.includes('来一首') ||
      normalizedMessage.includes('来几首') ||
      normalizedMessage.includes('来首') ||
      normalizedMessage.includes('放一首') ||
      normalizedMessage.includes('放几首') ||
      normalizedMessage.includes('播一首') ||
      normalizedMessage.includes('播几首') ||
      normalizedMessage.includes('来点') ||
      normalizedMessage.includes('放个')
    ) {
      return 'queue_replace';
    }

    if (
      normalizedMessage.includes('介绍') ||
      normalizedMessage.includes('背景') ||
      normalizedMessage.includes('历史') ||
      normalizedMessage.includes('故事') ||
      normalizedMessage.includes('流派') ||
      normalizedMessage.includes('风格') ||
      normalizedMessage.includes('知识') ||
      normalizedMessage.includes('什么是') ||
      normalizedMessage.includes('谁写的') ||
      normalizedMessage.includes('什么时候出') ||
      normalizedMessage.includes('genre') ||
      normalizedMessage.includes('history') ||
      normalizedMessage.includes('background') ||
      normalizedMessage.includes('story')
    ) {
      return 'knowledge_query';
    }

    return 'conversation';
  }
}

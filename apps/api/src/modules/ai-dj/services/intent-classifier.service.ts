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
1. "queue_replace" — User wants to PLAY music or CHANGE what's currently playing. This is the DEFAULT for ANY request to hear music: playing a genre or mood ("play jazz", "放首中文歌", "来点摇滚", "放点爵士"), asking for a recommendation they want PLAYED ("推荐一首歌", "recommend something", "有什么好听的", "suggest a song"), requesting a different style ("换种风格", "something different"), or asking the DJ to choose ("你帮我选", "surprise me", "随便来一首"). If the user wants to HEAR music, use this intent.

2. "queue_append" — User wants to ADD more tracks WITHOUT replacing what's currently playing. They explicitly want MORE of the same, not a change. Chinese cues: 加一首、加几首、再来一首、补一首、多来点、追加. English cues: "add more", "append", "more like this", "another one".

3. "theme_playlist_preview" — User wants a CURATED PLAYLIST or collection built (multiple tracks as a themed set, not just one song). Chinese cues: 歌单、做个歌单、做一份、做张、整理一个列表、做个合集. English cues: "playlist", "build a list", "curate", "make me a mix".

4. "recommend_explain" — User asks WHY something was recommended or seeks explanation about a specific recommendation. ONLY for "why did you pick this"-type questions. NOT for asking for new recommendations. Chinese cues: 为什么推这个、为什么推荐这首、解释一下推荐、背后逻辑、什么原因选的。English cues: "why this song", "why did you recommend", "explain this pick".

5. "knowledge_query" — User asks about music facts/knowledge — artist backgrounds, genre history, song stories, music theory. Educational, not about playing music. Chinese cues: 介绍、背景、历史、故事、流派、什么是、谁写的、什么时候出的。English cues: "tell me about", "who is", "history of", "what genre is", "story behind".

6. "conversation" — ONLY for pure chat with NO music-playing intent: greetings ("你好", "hi"), asking about the AI's capabilities ("你能做什么", "what can you do"), showing appreciation ("不错", "thanks", "great"), or truly open-ended chat without requesting music. If the user shows ANY desire to hear music, classify as "queue_replace" instead.

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

    // Map common LLM-invented intents to valid ones.
    // Priority: recommend → replace, since most LLM "recommend" intents
    // actually mean the user wants music played.
    if (
      /play|来|放|播|切换|切|change|switch|推荐|recommend|suggest/i.test(
        normalized,
      )
    ) {
      return 'queue_replace';
    }
    if (/歌单|playlist|curate|build|合集/i.test(normalized)) {
      return 'theme_playlist_preview';
    }
    if (/加|补|append|add|再来|多来/i.test(normalized)) {
      return 'queue_append';
    }
    if (/为什么|解释|explain|reason|背后/i.test(normalized)) {
      return 'recommend_explain';
    }
    if (
      /介绍|背景|历史|故事|流派|知识|什么是|谁写的|genre|history|background|story/i.test(
        normalized,
      )
    ) {
      return 'knowledge_query';
    }

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
    // Pattern-based classification using broader regex instead of exact
    // substring matching. Each group is tested in priority order so that
    // more-specific intents (explain, playlist, append) win over the
    // broader queue_replace pattern. Recommendations without specific
    // action words are now correctly routed to queue_replace.

    if (
      /(?:为什么|为何|怎么会|啥原因|什么依据|why|explain|reason|背后|怎么.*推)/i.test(
        normalizedMessage,
      )
    ) {
      return 'recommend_explain';
    }

    if (
      /(?:歌单|playlist|做(?:一份?|张|个)|建(?:一个?|张)|整理.*(?:歌|曲|列表)|推荐.*(?:歌单|列表|合集)|curat|build.*list|create.*playlist)/i.test(
        normalizedMessage,
      )
    ) {
      return 'theme_playlist_preview';
    }

    if (
      /(?:加|补|追加|再来|多来|再.*(?:来|放|播)|append|more.*like.*this|another.*(?:one|song|track))/i.test(
        normalizedMessage,
      )
    ) {
      return 'queue_append';
    }

    if (
      /(?:[换切].*[首歌]|[换切].*曲|换一?点|放一?点|来一?点|来[首点个些]|放[首点个些]|播[首点个些]|换[首点个些]|切[首歌]|[给帮]我.*(?:放|播|来|换|切|推荐|选)|推荐.*(?:首|歌|曲|音乐|一?下)|有什么.*(?:好听的|推荐|歌|音乐)|play|put on|switch|change.*(?:music|song|track)|我想听|听.*[首歌曲]|给我.*(?:歌|曲|音乐)|suggest|recommend)/i.test(
        normalizedMessage,
      )
    ) {
      return 'queue_replace';
    }

    if (
      /(?:介绍|背景|历史|故事|流派|风格|知识|什么是|谁写的|什么时候出|谁唱|怎么.*写|出自|来源|起源|genre|history|background|story|tell.*about|who.*(?:is|made|wrote|sang)|what.*genre|how.*made)/i.test(
        normalizedMessage,
      )
    ) {
      return 'knowledge_query';
    }

    return 'conversation';
  }
}

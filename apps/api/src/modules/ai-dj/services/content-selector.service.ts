import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../llm/services/llm.service';
import { ContentService } from '../../content/services/content.service';

interface TrackCandidate {
  id: string;
  title: string;
  artists: string;
  album: string;
  language: string;
  type: string;
}

@Injectable()
export class ContentSelectorService {
  private readonly logger = new Logger(ContentSelectorService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly contentService: ContentService,
  ) {}

  async selectContent(message: string, count: number): Promise<string[]> {
    const llmAvailable = await this.llmService.isAvailable();

    if (llmAvailable) {
      try {
        const result = await this.llmSelect(message, count);
        if (result.length > 0) {
          return result;
        }
      } catch (error) {
        this.logger.warn(
          `LLM content selection failed, using fallback: ${String(error)}`,
        );
      }
    }

    return this.fallbackSelect(message, count);
  }

  private async llmSelect(message: string, count: number): Promise<string[]> {
    const candidates = await this.fetchCandidates();

    if (candidates.length === 0) {
      return [];
    }

    const candidateList = candidates
      .map(
        (t) =>
          `{id:"${t.id}", title:"${t.title}", artists:"${t.artists}", album:"${t.album}", language:"${t.language}", type:"${t.type}"}`,
      )
      .join('\n');

    const systemPrompt = `You are a music content selector for Cusic. You are given a user's request and a catalog of available tracks with their metadata.

Available tracks:
${candidateList}

Select exactly ${count} tracks that best match the user's request. Consider mood, genre keywords, language preference (Chinese "zh" vs English "en" vs instrumental), and content type (track vs podcast).

Return ONLY a valid JSON object: {"contentIds": ["id1", "id2"], "reasoning": "Brief explanation."}`;

    const result = await this.llmService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User request: "${message}"` },
      ],
      {
        temperature: 0.3,
        maxTokens: 500,
        responseFormat: { type: 'json_object' },
        timeoutMs: 20_000,
      },
    );

    let jsonText = result.trim();

    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonText = fenceMatch[1].trim();
    }

    const braceStart = jsonText.indexOf('{');
    const braceEnd = jsonText.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      jsonText = jsonText.slice(braceStart, braceEnd + 1);
    }

    const parsed = JSON.parse(jsonText) as {
      contentIds?: string[];
      reasoning?: string;
    };

    const selectedIds = Array.isArray(parsed.contentIds)
      ? parsed.contentIds.slice(0, count)
      : [];

    const validIds = (await this.contentService.getByIds(selectedIds)).map(
      (item) => item.id,
    );

    return validIds;
  }

  private async fetchCandidates(): Promise<TrackCandidate[]> {
    const result = await this.contentService.search({
      page: 1,
      pageSize: 50,
    });

    return result.items.map((item) => ({
      id: item.id,
      title: item.title,
      artists: (item.artists ?? []).join(', '),
      album: item.album ?? '',
      language: item.language ?? 'en',
      type: item.type,
    }));
  }

  async fallbackSelect(
    normalizedMessage: string,
    count: number = 3,
  ): Promise<string[]> {
    // Extract meaningful keywords from the user's message for content search.
    const keywords = this.extractSearchKeywords(normalizedMessage);

    if (keywords.length > 0) {
      // Search the library with extracted keywords
      const searchResult = await this.contentService.search({
        q: keywords.join(' '),
        page: 1,
        pageSize: count,
      });

      if (searchResult.items.length > 0) {
        return searchResult.items.map((item) => item.id);
      }
    }

    // Use mood-based pools as a last resort
    const pool = this.resolveMoodPool(normalizedMessage);
    const validIds = (await this.contentService.getByIds(pool)).map(
      (item) => item.id,
    );

    return validIds.slice(0, count);
  }

  private extractSearchKeywords(message: string): string[] {
    // Strip out command/action words to leave just the content description.
    const stripped = message
      .replace(
        /[来放播换切听给帮]一?[首点个些首歌]|我想|给我|帮我|推荐|有什么|来点|放点|换点|换一种|切歌|换歌|歌单|playlist|play|put on|switch|change.*(?:music|song|track)|give me|i want|can you/gi,
        ' ',
      )
      .replace(/[，。！？,.!?]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!stripped) return [];

    // Split into words and filter out very short noise
    return stripped
      .split(/\s+/)
      .filter((w) => w.length >= 1)
      .slice(0, 5);
  }

  private resolveMoodPool(normalizedMessage: string): string[] {
    // Broader mood pools with more entries and overlapping keywords.
    const lower = normalizedMessage.toLowerCase();

    if (
      lower.includes('粤语') ||
      lower.includes('cantopop') ||
      lower.includes('港')
    ) {
      return ['cnt_canton_midnight', 'cnt_canto_neon', 'cnt_city_rain'];
    }

    if (
      lower.includes('podcast') ||
      lower.includes('播客') ||
      lower.includes('brief')
    ) {
      return ['cnt_podcast_brief', 'cnt_editorial_dusk', 'cnt_focus_fm'];
    }

    if (
      lower.includes('早') ||
      lower.includes('morning') ||
      lower.includes('通勤')
    ) {
      return ['cnt_morning_wire', 'cnt_editorial_dusk', 'cnt_city_rain'];
    }

    if (
      lower.includes('专注') ||
      lower.includes('工作') ||
      lower.includes('focus') ||
      lower.includes('写') ||
      lower.includes('code') ||
      lower.includes('学习')
    ) {
      return ['cnt_focus_fm', 'cnt_afterhours_loop', 'cnt_editorial_dusk'];
    }

    if (
      lower.includes('夜') ||
      lower.includes('late') ||
      lower.includes('深夜') ||
      lower.includes('midnight') ||
      lower.includes('睡觉') ||
      lower.includes('放松')
    ) {
      return ['cnt_canton_midnight', 'cnt_afterhours_loop', 'cnt_city_rain'];
    }

    if (
      lower.includes('radio') ||
      lower.includes('电台') ||
      lower.includes('signal')
    ) {
      return ['cnt_focus_fm', 'cnt_podcast_brief', 'cnt_editorial_dusk'];
    }

    if (
      lower.includes('摇滚') ||
      lower.includes('rock') ||
      lower.includes('吉他') ||
      lower.includes('guitar')
    ) {
      return ['cnt_afterhours_loop', 'cnt_city_rain', 'cnt_focus_fm'];
    }

    if (
      lower.includes('电子') ||
      lower.includes('electronic') ||
      lower.includes('舞曲') ||
      lower.includes('dance') ||
      lower.includes('edm')
    ) {
      return ['cnt_canto_neon', 'cnt_afterhours_loop', 'cnt_focus_fm'];
    }

    if (
      lower.includes('爵士') ||
      lower.includes('jazz') ||
      lower.includes('古典') ||
      lower.includes('classical') ||
      lower.includes('钢琴') ||
      lower.includes('piano')
    ) {
      return ['cnt_editorial_dusk', 'cnt_city_rain', 'cnt_focus_fm'];
    }

    // Default: return all available pools
    return [
      'cnt_editorial_dusk',
      'cnt_focus_fm',
      'cnt_afterhours_loop',
      'cnt_city_rain',
      'cnt_canton_midnight',
      'cnt_canto_neon',
      'cnt_morning_wire',
      'cnt_podcast_brief',
    ];
  }
}

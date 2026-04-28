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

  async selectContent(
    message: string,
    count: number,
  ): Promise<string[]> {
    const llmAvailable = await this.llmService.isAvailable();

    if (llmAvailable) {
      try {
        const result = await this.llmSelect(message, count);
        if (result.length > 0) {
          return result;
        }
      } catch (error) {
        this.logger.warn(`LLM content selection failed, using fallback: ${String(error)}`);
      }
    }

    return this.fallbackSelect(message);
  }

  private async llmSelect(
    message: string,
    count: number,
  ): Promise<string[]> {
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
        timeoutMs: 8_000,
      },
    );

    const parsed = JSON.parse(result.trim()) as {
      contentIds?: string[];
      reasoning?: string;
    };

    const selectedIds = Array.isArray(parsed.contentIds)
      ? parsed.contentIds.slice(0, count)
      : [];

    const validIds = (
      await this.contentService.getByIds(selectedIds)
    ).map((item) => item.id);

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

  async fallbackSelect(normalizedMessage: string): Promise<string[]> {
    const pools: string[][] = [];

    if (
      normalizedMessage.includes('粤语') ||
      normalizedMessage.includes('cantopop') ||
      normalizedMessage.includes('港')
    ) {
      pools.push(['cnt_canton_midnight', 'cnt_canto_neon', 'cnt_city_rain']);
    }

    if (
      normalizedMessage.includes('podcast') ||
      normalizedMessage.includes('播客') ||
      normalizedMessage.includes('brief')
    ) {
      pools.push(['cnt_podcast_brief', 'cnt_editorial_dusk', 'cnt_focus_fm']);
    }

    if (
      normalizedMessage.includes('morning') ||
      normalizedMessage.includes('早') ||
      normalizedMessage.includes('通勤')
    ) {
      pools.push(['cnt_morning_wire', 'cnt_editorial_dusk', 'cnt_city_rain']);
    }

    if (
      normalizedMessage.includes('focus') ||
      normalizedMessage.includes('工作') ||
      normalizedMessage.includes('写') ||
      normalizedMessage.includes('code') ||
      normalizedMessage.includes('专注')
    ) {
      pools.push(['cnt_focus_fm', 'cnt_afterhours_loop', 'cnt_editorial_dusk']);
    }

    if (
      normalizedMessage.includes('夜') ||
      normalizedMessage.includes('late') ||
      normalizedMessage.includes('深夜') ||
      normalizedMessage.includes('midnight')
    ) {
      pools.push([
        'cnt_canton_midnight',
        'cnt_afterhours_loop',
        'cnt_city_rain',
      ]);
    }

    if (
      normalizedMessage.includes('radio') ||
      normalizedMessage.includes('电台') ||
      normalizedMessage.includes('signal')
    ) {
      pools.push(['cnt_focus_fm', 'cnt_podcast_brief', 'cnt_editorial_dusk']);
    }

    pools.push(['cnt_editorial_dusk', 'cnt_focus_fm', 'cnt_afterhours_loop']);

    const merged = [...new Set(pools.flat())];
    const validIds = (await this.contentService.getByIds(merged)).map(
      (item) => item.id,
    );

    return validIds;
  }
}

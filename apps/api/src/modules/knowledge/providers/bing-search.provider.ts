import { Injectable, Logger } from '@nestjs/common';
import type {
  WebSearchProvider,
  WebSearchResult,
} from './web-search.interface';

export interface BingSearchConfig {
  apiKey: string;
  endpoint: string;
}

/** Fallback provider used when Bing API key is not configured. */
@Injectable()
export class NoOpWebSearchProvider implements WebSearchProvider {
  async search(_query: string): Promise<WebSearchResult[]> {
    return [];
  }
}

@Injectable()
export class BingWebSearchProvider implements WebSearchProvider {
  private readonly logger = new Logger(BingWebSearchProvider.name);

  constructor(private readonly config: BingSearchConfig) {}

  async search(query: string): Promise<WebSearchResult[]> {
    try {
      const url = new URL(this.config.endpoint);
      url.searchParams.set('q', query);
      url.searchParams.set('count', '5');
      url.searchParams.set('mkt', 'zh-CN');

      const response = await fetch(url.toString(), {
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `Bing search returned HTTP ${response.status}: ${response.statusText}`,
        );
        return [];
      }

      const data = (await response.json()) as {
        webPages?: {
          value?: Array<{
            name: string;
            snippet: string;
            url: string;
          }>;
        };
      };

      const results: WebSearchResult[] =
        data.webPages?.value?.map((r) => ({
          title: r.name,
          snippet: r.snippet,
          url: r.url,
        })) ?? [];

      if (results.length === 0) {
        this.logger.warn('Bing search returned no web results');
      }

      return results;
    } catch (error) {
      this.logger.warn(`Bing search failed: ${String(error)}`);
      return [];
    }
  }
}

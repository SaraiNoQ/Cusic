export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export const WEB_SEARCH_PROVIDER = 'WEB_SEARCH_PROVIDER';

export interface WebSearchProvider {
  search(query: string): Promise<WebSearchResult[]>;
}

import type {
  ApiSuccessEnvelope,
  ContentItemDto,
  PaginationMeta,
} from '@music-ai/shared';
import { apiFetch } from './client';

export type SearchResponse = ApiSuccessEnvelope<{ items: ContentItemDto[] }> & {
  meta?: PaginationMeta;
};

export async function searchContent(query: string) {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('q', query.trim());
  }

  return apiFetch<SearchResponse>(`/search?${params.toString()}`);
}

export async function fetchContentById(contentId: string) {
  const response = await apiFetch<ApiSuccessEnvelope<ContentItemDto>>(
    `/content/${contentId}`,
  );
  return response.data;
}

export async function fetchRelatedContent(contentId: string) {
  const response = await apiFetch<
    ApiSuccessEnvelope<{ sourceContentId: string; items: ContentItemDto[] }>
  >(`/content/${contentId}/related`);
  return response.data.items;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ContentItemDto {
  id: string;
  type: 'track' | 'podcast' | 'radio' | 'album';
  title: string;
  artists: string[];
  album?: string | null;
  durationMs?: number | null;
  language?: string | null;
  coverUrl?: string | null;
  playable?: boolean;
}

export interface RecommendationCardDto {
  contentId: string;
  title: string;
  reason: string;
}

export interface TasteTagDto {
  type: string;
  value: string;
  weight: number;
  isNegative: boolean;
}

export interface TasteProfileDto {
  summary: string;
  explorationLevel: string;
  tags: TasteTagDto[];
}

export interface ChatTurnRequestDto {
  sessionId?: string;
  message: string;
  responseMode: 'sync' | 'stream';
}

export interface ChatTurnResponseDto {
  sessionId: string;
  messageId: string;
  replyText: string;
  actions: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;
}


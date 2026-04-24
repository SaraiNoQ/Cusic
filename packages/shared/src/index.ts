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

export interface RequestEmailCodeDto {
  email: string;
}

export interface RequestEmailCodeResponseDto {
  cooldownSeconds: number;
}

export interface LoginRequestDto {
  email: string;
  code: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthTokenPairDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user?: AuthUserDto;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface LogoutResponseDto {
  loggedOut: boolean;
}

export type ContentType = 'track' | 'podcast' | 'radio' | 'album';

export interface ContentItemDto {
  id: string;
  type: ContentType;
  title: string;
  artists: string[];
  album?: string | null;
  durationMs?: number | null;
  language?: string | null;
  coverUrl?: string | null;
  audioUrl?: string | null;
  playable?: boolean;
}

export interface SearchResultDto {
  items: ContentItemDto[];
}

export type QueueMode = 'replace' | 'append';

export interface QueueItemDto {
  contentId: string;
}

export interface QueueUpdateDto {
  mode: QueueMode;
  items: QueueItemDto[];
}

export interface PlaybackEventPayloadDto {
  contentId: string;
  eventType: 'PLAY_STARTED' | 'PLAY_PAUSED' | 'PLAY_COMPLETED' | 'SKIPPED';
  positionMs?: number;
  occurredAt: string;
}

export interface PlaylistSummaryDto {
  id: string;
  title: string;
  description: string;
  playlistType: 'user_created' | 'ai_generated' | 'daily' | 'imported';
  itemCount: number;
}

export interface FavoriteDto {
  contentId: string;
  favoriteType: 'track' | 'podcast' | 'radio' | 'album';
}

export interface FavoriteSummaryDto {
  contentId: string;
  favoriteType: 'track' | 'podcast' | 'radio' | 'album';
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

export interface AiDjActionDto {
  type: string;
  payload: {
    contentIds?: string[];
    [key: string]: unknown;
  };
}

export interface ChatMessageVm {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

export interface PlayerSurfaceState {
  queue: ContentItemDto[];
  currentTrack: ContentItemDto | null;
  activeIndex: number;
  isPlaying: boolean;
  progressSeconds: number;
  durationSeconds: number;
  statusText: string;
}

export interface ChatPanelState {
  sessionId?: string;
  input: string;
  isPending: boolean;
  messages: ChatMessageVm[];
}

export interface SearchOverlayState {
  isOpen: boolean;
  query: string;
}

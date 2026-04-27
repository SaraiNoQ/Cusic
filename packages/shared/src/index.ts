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
  activeIndex?: number;
  currentContentId?: string | null;
  positionMs?: number;
}

export interface PlayerQueueStateDto {
  queueId: string;
  mode?: QueueMode;
  count: number;
  items: ContentItemDto[];
  activeIndex: number;
  currentTrack: ContentItemDto | null;
  positionMs: number;
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

export interface PlaylistItemDto {
  position: number;
  content: ContentItemDto;
}

export interface PlaylistDetailDto extends PlaylistSummaryDto {
  items: PlaylistItemDto[];
}

export interface UpdatePlaylistDto {
  title?: string;
  description?: string;
}

export interface PlaylistItemsAppendResponseDto {
  playlistId: string;
  addedCount: number;
  skippedCount: number;
  itemCount: number;
}

export interface PlaylistItemRemovalResponseDto {
  playlistId: string;
  contentId: string;
  removed: boolean;
  itemCount: number;
}

export interface PlaylistDeleteResponseDto {
  playlistId: string;
  deleted: boolean;
}

export interface PlaylistUpdateResponseDto {
  updated: boolean;
  playlist: PlaylistDetailDto | null;
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
  content: ContentItemDto;
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

export interface TasteTagUpdateDto {
  type: string;
  value: string;
  action: 'increase' | 'decrease' | 'remove';
}

export interface UpdateTasteTagsDto {
  updates: TasteTagUpdateDto[];
}

export interface TasteProfileUpdateResponseDto {
  updated: number;
  profile: TasteProfileDto;
}

export interface NowRecommendationDto {
  recommendationId: string;
  explanation: string;
  items: RecommendationCardDto[];
}

export interface DailyPlaylistDto {
  playlistId: string;
  title: string;
  description: string;
  itemCount: number;
  recommendationResultId: string | null;
  items: ContentItemDto[];
}

export interface RecommendationFeedbackDto {
  targetType: string;
  targetId: string;
  feedbackType: 'like' | 'dislike' | 'more_like_this' | 'less_like_this';
  recommendationResultId?: string | null;
  reasonText?: string | null;
}

export interface RecommendationFeedbackResponseDto {
  feedbackId: string;
  recorded: boolean;
}

export interface ChatSurfaceContextDto {
  currentTrackId?: string | null;
  queueContentIds?: string[];
}

export interface ChatTurnRequestDto {
  sessionId?: string;
  message: string;
  responseMode: 'sync' | 'stream';
  surfaceContext?: ChatSurfaceContextDto;
}

export type AiDjIntent =
  | 'queue_replace'
  | 'queue_append'
  | 'recommend_explain'
  | 'theme_playlist_preview';

export interface AiDjQueueReplaceActionDto {
  type: 'queue_replace';
  payload: {
    contentIds: string[];
  };
}

export interface AiDjQueueAppendActionDto {
  type: 'queue_append';
  payload: {
    contentIds: string[];
  };
}

export type AiDjActionDto =
  | AiDjQueueReplaceActionDto
  | AiDjQueueAppendActionDto;

export interface ChatTurnResponseDto {
  sessionId: string;
  messageId: string;
  intent: AiDjIntent;
  replyText: string;
  actions: AiDjActionDto[];
}

export interface AiDjStreamChunkEventDto {
  event: 'chunk';
  sessionId: string;
  messageId: string;
  delta: string;
}

export interface AiDjStreamActionsEventDto {
  event: 'actions';
  sessionId: string;
  messageId: string;
  actions: AiDjActionDto[];
}

export interface AiDjStreamDoneEventDto {
  event: 'done';
  sessionId: string;
  messageId: string;
  replyText: string;
  actions: AiDjActionDto[];
}

export type AiDjStreamEventDto =
  | AiDjStreamChunkEventDto
  | AiDjStreamActionsEventDto
  | AiDjStreamDoneEventDto;

export interface ChatSessionMessageDto {
  id: string;
  role: 'assistant' | 'user';
  messageType: 'text' | 'action';
  text: string;
  intent?: AiDjIntent | null;
  actions?: AiDjActionDto[];
  createdAt: string;
}

export interface ChatMessageVm {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  intent?: AiDjIntent | null;
  actions?: AiDjActionDto[];
}

export interface SaveAiPlaylistRequestDto {
  sessionId: string;
  messageId: string;
  title?: string;
}

export interface SaveAiPlaylistResponseDto {
  created: boolean;
  playlist: PlaylistSummaryDto | null;
}

export type ImportJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type ImportJobType = 'playlist_import' | 'history_import';

export type ImportJobExecutionMode = 'baseline_stub' | 'worker_stub' | 'provider_live';

export type ImportJobExecutionPhase =
  | 'accepted'
  | 'running'
  | 'completed'
  | 'failed';

export interface ImportJobResultSummaryDto {
  mode: ImportJobExecutionMode;
  phase: ImportJobExecutionPhase;
  accepted?: boolean;
  importType?: 'playlist' | 'history';
  providerName?: string;
  summaryText?: string;
  importedItemCount?: number;
  playlistCount?: number;
  historyItemCount?: number;
  warnings?: string[];
}

export interface CreateImportJobRequestDto {
  providerName: string;
  importType: 'playlist' | 'history';
  payload: Record<string, unknown>;
}

export interface ImportJobDto {
  jobId: string;
  status: ImportJobStatus;
  providerName: string;
  jobType: ImportJobType;
  payload: Record<string, unknown>;
  resultSummary: ImportJobResultSummaryDto | null;
  errorText: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export const IMPORTS_QUEUE_NAME = 'music-ai-imports';

export interface ImportQueueJobData {
  jobId: string;
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

export interface ProviderConnectionStatusDto {
  provider: string;
  connected: boolean;
  message: string;
}

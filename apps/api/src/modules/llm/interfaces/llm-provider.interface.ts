export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmChatMessage[];
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  responseFormat?: { type: 'json_object' } | { type: 'text' };
}

export interface LlmCompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LlmStreamEvent {
  type: 'chunk' | 'done';
  content?: string;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  streamComplete(
    request: LlmCompletionRequest,
    onEvent: (event: LlmStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  embed(texts: string[]): Promise<number[][]>;
  isAvailable(): Promise<boolean>;
}

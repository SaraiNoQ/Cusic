import OpenAI from 'openai';
import type {
  LLMProvider,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmStreamEvent,
} from '../interfaces/llm-provider.interface';

export interface DeepseekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  requestTimeoutMs: number;
}

export class DeepseekLlmProvider implements LLMProvider {
  readonly name = 'deepseek';
  readonly model: string;

  private readonly client: OpenAI;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;
  private readonly requestTimeoutMs: number;

  constructor(config: DeepseekConfig) {
    this.model = config.model;
    this.defaultTemperature = config.temperature;
    this.defaultMaxTokens = config.maxTokens;
    this.requestTimeoutMs = config.requestTimeoutMs;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.requestTimeoutMs,
      maxRetries: 0,
    });
  }

  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model ?? this.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature ?? this.defaultTemperature,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
      stream: false,
      ...(request.responseFormat?.type === 'json_object'
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? '',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async streamComplete(
    request: LlmCompletionRequest,
    onEvent: (event: LlmStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const stream = await this.client.chat.completions.create({
      model: request.model ?? this.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature ?? this.defaultTemperature,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
      stream: true,
    });

    const abortHandler = () => {
      try {
        stream.controller.abort();
      } catch {
        // controller may already be done
      }
    };

    if (signal) {
      if (signal.aborted) {
        stream.controller.abort();
        return;
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          onEvent({ type: 'chunk', content: delta });
        }
      }
    } finally {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    }

    onEvent({ type: 'done' });
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map((d: { embedding: number[] }) => d.embedding);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

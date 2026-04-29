import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  LLMProvider,
  LlmChatMessage,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmStreamEvent,
} from '../interfaces/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../llm.constants';

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    @Inject(LLM_PROVIDER_TOKEN)
    private readonly provider: LLMProvider,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!(await this.isAvailable())) {
      throw new LlmUnavailableError('LLM provider is not available');
    }
    try {
      const result = await this.provider.embed(texts);
      this.onSuccess();
      return result;
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        throw error;
      }
      this.onFailure(error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (this.circuitOpenUntil > Date.now()) {
      return false;
    }

    try {
      const available = await this.provider.isAvailable();
      return available;
    } catch {
      return false;
    }
  }

  async chat(
    messages: LlmChatMessage[],
    opts?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: LlmCompletionRequest['responseFormat'];
      timeoutMs?: number;
    },
  ): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new LlmUnavailableError('LLM provider is not available');
    }

    const request: LlmCompletionRequest = {
      messages,
      stream: false,
      temperature: opts?.temperature,
      maxTokens: opts?.maxTokens,
      responseFormat: opts?.responseFormat,
    };

    try {
      const result = await this.withTimeout(
        this.provider.complete(request),
        opts?.timeoutMs ?? 15_000,
      );
      this.onSuccess();
      return result.content;
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        throw error;
      }
      this.onFailure(error);
      throw error;
    }
  }

  async streamChat(
    messages: LlmChatMessage[],
    onChunk: (delta: string) => void,
    opts?: {
      temperature?: number;
      maxTokens?: number;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
  ): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new LlmUnavailableError('LLM provider is not available');
    }

    const request: LlmCompletionRequest = {
      messages,
      stream: true,
      temperature: opts?.temperature,
      maxTokens: opts?.maxTokens,
    };

    let accumulated = '';

    try {
      await this.provider.streamComplete(
        request,
        (event: LlmStreamEvent) => {
          if (event.type === 'chunk' && event.content) {
            accumulated += event.content;
            onChunk(event.content);
          }
        },
        opts?.signal,
      );
      this.onSuccess();
      return accumulated;
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        throw error;
      }
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private onFailure(error: unknown): void {
    this.consecutiveFailures++;
    this.logger.warn(
      `LLM call failed (${this.consecutiveFailures}/${CIRCUIT_BREAKER_THRESHOLD}): ${String(error)}`,
    );

    if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      this.logger.error(
        `Circuit breaker opened until ${new Date(this.circuitOpenUntil).toISOString()}`,
      );
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`LLM request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

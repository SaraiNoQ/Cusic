import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  LLMProvider,
  LlmChatMessage,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmStreamEvent,
} from '../interfaces/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../llm.constants';
import { getRequestId } from '../../../common/request-id';

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

    // Log circuit re-closure if it was previously open
    if (this.circuitOpenUntil > 0 && this.circuitOpenUntil <= Date.now()) {
      this.logger.log(
        `[${getRequestId()}] Circuit breaker cooldown expired — circuit closed`,
      );
      this.circuitOpenUntil = 0;
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
    if (this.consecutiveFailures > 0) {
      this.logger.log(
        `[${getRequestId()}] LLM call succeeded — resetting consecutive failures from ${this.consecutiveFailures} to 0`,
      );
    }
    this.consecutiveFailures = 0;
  }

  private onFailure(error: unknown): void {
    this.consecutiveFailures++;
    this.logger.warn(
      `[${getRequestId()}] LLM call failed (${this.consecutiveFailures}/${CIRCUIT_BREAKER_THRESHOLD}): ${String(error)}`,
    );

    if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      this.logger.error(
        `[${getRequestId()}] Circuit breaker OPENED — next retry allowed after ${new Date(this.circuitOpenUntil).toISOString()} (cooldown ${CIRCUIT_BREAKER_COOLDOWN_MS}ms)`,
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

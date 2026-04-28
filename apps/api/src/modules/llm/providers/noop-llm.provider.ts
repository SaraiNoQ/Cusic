import type {
  LLMProvider,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '../interfaces/llm-provider.interface';

export class NoOpLlmProvider implements LLMProvider {
  readonly name = 'noop';
  readonly model = 'none';

  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    return { content: '' };
  }

  async streamComplete(
    _request: LlmCompletionRequest,
    onEvent: (event: { type: 'chunk' | 'done'; content?: string }) => void,
    _signal?: AbortSignal,
  ): Promise<void> {
    onEvent({ type: 'done' });
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER_TOKEN } from './llm.constants';
import { DeepseekLlmProvider } from './providers/deepseek-llm.provider';
import { NoOpLlmProvider } from './providers/noop-llm.provider';
import { LlmService } from './services/llm.service';

@Global()
@Module({
  providers: [
    {
      provide: LLM_PROVIDER_TOKEN,
      useFactory: (config: ConfigService) => {
        const enabled =
          config.get<string>('LLM_ENABLED', 'true').toLowerCase() !== 'false';
        const apiKey = config.get<string>('LLM_API_KEY');

        if (!enabled || !apiKey || apiKey === 'replace-me') {
          return new NoOpLlmProvider();
        }

        return new DeepseekLlmProvider({
          apiKey,
          baseUrl: config.get<string>(
            'LLM_BASE_URL',
            'https://api.deepseek.com/v1',
          ),
          model: config.get<string>('LLM_MODEL', 'deepseek-v4-pro'),
          temperature: Number(
            config.get<string>('LLM_TEMPERATURE', '0.7'),
          ),
          maxTokens: Number(
            config.get<string>('LLM_MAX_TOKENS', '1024'),
          ),
          requestTimeoutMs: Number(
            config.get<string>('LLM_REQUEST_TIMEOUT_MS', '15000'),
          ),
        });
      },
      inject: [ConfigService],
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { WEB_SEARCH_PROVIDER } from './providers/web-search.interface';
import {
  BingWebSearchProvider,
  NoOpWebSearchProvider,
} from './providers/bing-search.provider';

@Module({
  imports: [PrismaModule, LlmModule, AuthModule],
  controllers: [KnowledgeController],
  providers: [
    {
      provide: WEB_SEARCH_PROVIDER,
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('BING_SEARCH_API_KEY');
        const endpoint = config.get<string>(
          'BING_SEARCH_ENDPOINT',
          'https://api.bing.microsoft.com/v7.0/search',
        );

        if (!apiKey || apiKey === 'replace-me' || apiKey.length === 0) {
          return new NoOpWebSearchProvider();
        }

        return new BingWebSearchProvider({ apiKey, endpoint });
      },
      inject: [ConfigService],
    },
    KnowledgeService,
  ],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}

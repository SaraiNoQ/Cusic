import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { RequestIdInterceptor } from '../common/request-id';
import { AiDjModule } from './ai-dj/ai-dj.module';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { ContextModule } from './context/context.module';
import { EventsModule } from './events/events.module';
import { ImportsModule } from './imports/imports.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LibraryModule } from './library/library.module';
import { LlmModule } from './llm/llm.module';
import { ProfileModule } from './profile/profile.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { SystemModule } from './system/system.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SystemModule,
    PrismaModule,
    LlmModule,
    AuthModule,
    ContentModule,
    LibraryModule,
    ProfileModule,
    ContextModule,
    RecommendationModule,
    AiDjModule,
    KnowledgeModule,
    VoiceModule,
    EventsModule,
    ImportsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
  ],
})
export class AppModule {}

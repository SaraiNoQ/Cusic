import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
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
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        genReqId: (req: Record<string, unknown>) => {
          const id = (req as Record<string, unknown>).requestId as
            | string
            | undefined;
          return id || undefined;
        },
        autoLogging: {
          ignore: (req: Record<string, unknown>) =>
            ((req as Record<string, unknown>).url as string)?.includes(
              '/system/health',
            ),
        },
      },
    }),
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
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
  ],
})
export class AppModule {}

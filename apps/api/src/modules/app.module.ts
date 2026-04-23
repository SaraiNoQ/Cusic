import { Module } from '@nestjs/common';
import { AiDjModule } from './ai-dj/ai-dj.module';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { ContextModule } from './context/context.module';
import { EventsModule } from './events/events.module';
import { ImportsModule } from './imports/imports.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LibraryModule } from './library/library.module';
import { ProfileModule } from './profile/profile.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { SystemModule } from './system/system.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    SystemModule,
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
})
export class AppModule {}


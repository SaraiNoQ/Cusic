import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { LibraryModule } from '../library/library.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { AiDjController } from './controllers/ai-dj.controller';
import { AiDjService } from './services/ai-dj.service';
import { ContentSelectorService } from './services/content-selector.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { ReplyGeneratorService } from './services/reply-generator.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ContentModule,
    RecommendationModule,
    LibraryModule,
  ],
  controllers: [AiDjController],
  providers: [
    AiDjService,
    IntentClassifierService,
    ContentSelectorService,
    ReplyGeneratorService,
  ],
})
export class AiDjModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { LibraryModule } from '../library/library.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { AiDjController } from './controllers/ai-dj.controller';
import { AiDjService } from './services/ai-dj.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    ContentModule,
    RecommendationModule,
    LibraryModule,
  ],
  controllers: [AiDjController],
  providers: [AiDjService],
})
export class AiDjModule {}

import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { AiDjController } from './controllers/ai-dj.controller';
import { AiDjService } from './services/ai-dj.service';

@Module({
  imports: [ContentModule],
  controllers: [AiDjController],
  providers: [AiDjService],
})
export class AiDjModule {}

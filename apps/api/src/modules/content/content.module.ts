import { Module } from '@nestjs/common';
import { ContentController } from './controllers/content.controller';
import { JamendoContentProvider } from './providers/jamendo-content.provider';
import { MockContentProvider } from './providers/mock-content.provider';
import { ContentService } from './services/content.service';
import { EmbeddingService } from './services/embedding.service';

@Module({
  controllers: [ContentController],
  providers: [
    MockContentProvider,
    JamendoContentProvider,
    ContentService,
    EmbeddingService,
  ],
  exports: [ContentService, EmbeddingService],
})
export class ContentModule {}

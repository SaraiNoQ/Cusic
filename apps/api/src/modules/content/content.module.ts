import { Module } from '@nestjs/common';
import { ContentController } from './controllers/content.controller';
import { MockContentProvider } from './providers/mock-content.provider';
import { ContentService } from './services/content.service';

@Module({
  controllers: [ContentController],
  providers: [MockContentProvider, ContentService],
  exports: [ContentService],
})
export class ContentModule {}

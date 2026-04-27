import { Module } from '@nestjs/common';
import { ContentController } from './controllers/content.controller';
import { JamendoContentProvider } from './providers/jamendo-content.provider';
import { MockContentProvider } from './providers/mock-content.provider';
import { ContentService } from './services/content.service';

@Module({
  controllers: [ContentController],
  providers: [MockContentProvider, JamendoContentProvider, ContentService],
  exports: [ContentService],
})
export class ContentModule {}

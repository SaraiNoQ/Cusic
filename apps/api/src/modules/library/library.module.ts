import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { LibraryController } from './controllers/library.controller';
import { LibraryService } from './services/library.service';

@Module({
  imports: [ContentModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { LibraryController } from './controllers/library.controller';
import { LibraryService } from './services/library.service';

@Module({
  imports: [AuthModule, ContentModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}

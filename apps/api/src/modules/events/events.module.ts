import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { EventsController } from './controllers/events.controller';
import { EventsService } from './services/events.service';

@Module({
  imports: [AuthModule, ContentModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}

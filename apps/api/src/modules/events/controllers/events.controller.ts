import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlaybackEventDto } from '../dto/playback-event.dto';
import { QueueUpdateDto } from '../dto/queue-update.dto';
import { EventsService } from '../services/events.service';

@ApiTags('player')
@Controller('player')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('queue')
  @ApiOperation({ summary: 'Replace or append player queue' })
  @ApiResponse({ status: 200, description: 'Queue updated' })
  updateQueue(@Body() body: QueueUpdateDto) {
    return {
      success: true,
      data: this.eventsService.updateQueue(
        body.mode as 'replace' | 'append',
        body.items ?? [],
      ),
      meta: {},
    };
  }

  @Post('events')
  @ApiOperation({ summary: 'Record playback event' })
  @ApiResponse({ status: 200, description: 'Playback event recorded' })
  recordPlaybackEvent(@Body() body: PlaybackEventDto) {
    return {
      success: true,
      data: this.eventsService.recordPlaybackEvent({
        contentId: body.contentId,
        eventType: body.eventType as
          | 'PLAY_STARTED'
          | 'PLAY_PAUSED'
          | 'PLAY_COMPLETED'
          | 'SKIPPED',
        positionMs: body.positionMs,
        occurredAt: body.occurredAt,
      }),
      meta: {},
    };
  }
}

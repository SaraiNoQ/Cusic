import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestWithUser } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { PlaybackEventDto } from '../dto/playback-event.dto';
import { QueueUpdateDto } from '../dto/queue-update.dto';
import { EventsService } from '../services/events.service';

@ApiTags('player')
@Controller('player')
@UseGuards(OptionalJwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get current player queue' })
  @ApiResponse({ status: 200, description: 'Current queue state' })
  async getQueue(@Req() request: RequestWithUser) {
    return {
      success: true,
      data: await this.eventsService.getQueue(request.user?.id),
      meta: {},
    };
  }

  @Post('queue')
  @ApiOperation({ summary: 'Replace or append player queue' })
  @ApiResponse({ status: 200, description: 'Queue updated' })
  async updateQueue(
    @Body() body: QueueUpdateDto,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.eventsService.updateQueue(
        body.mode as 'replace' | 'append',
        body.items ?? [],
        {
          activeIndex: body.activeIndex,
          currentContentId: body.currentContentId,
          positionMs: body.positionMs,
        },
        request.user?.id,
      ),
      meta: {},
    };
  }

  @Post('events')
  @ApiOperation({ summary: 'Record playback event' })
  @ApiResponse({ status: 200, description: 'Playback event recorded' })
  async recordPlaybackEvent(
    @Body() body: PlaybackEventDto,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.eventsService.recordPlaybackEvent(
        {
          contentId: body.contentId,
          eventType: body.eventType as
            | 'PLAY_STARTED'
            | 'PLAY_PAUSED'
            | 'PLAY_COMPLETED'
            | 'SKIPPED',
          positionMs: body.positionMs,
          occurredAt: body.occurredAt,
        },
        request.user?.id,
      ),
      meta: {},
    };
  }
}

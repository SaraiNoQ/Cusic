import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

class QueueItemDto {
  @IsString()
  contentId!: string;
}

class QueueUpdateDto {
  @IsString()
  mode!: string;

  items!: QueueItemDto[];
}

class PlaybackEventDto {
  @IsString()
  contentId!: string;

  @IsString()
  eventType!: string;

  @IsOptional()
  @IsNumber()
  positionMs?: number;

  @IsString()
  occurredAt!: string;
}

@ApiTags('player')
@ApiBearerAuth()
@Controller('player')
export class EventsController {
  @Post('queue')
  @ApiOperation({ summary: 'Replace or append player queue' })
  @ApiResponse({ status: 200, description: 'Queue updated' })
  updateQueue(@Body() body: QueueUpdateDto) {
    return {
      success: true,
      data: {
        queueId: 'queue_stub',
        mode: body.mode,
        count: body.items?.length ?? 0,
      },
      meta: {},
    };
  }

  @Post('events')
  @ApiOperation({ summary: 'Record playback event' })
  @ApiResponse({ status: 200, description: 'Playback event recorded' })
  recordPlaybackEvent(@Body() body: PlaybackEventDto) {
    return {
      success: true,
      data: {
        accepted: true,
        eventType: body.eventType,
      },
      meta: {},
    };
  }
}


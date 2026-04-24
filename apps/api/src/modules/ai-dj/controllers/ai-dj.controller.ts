import { Body, Controller, Post, Query, Sse } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable, of } from 'rxjs';
import { ChatTurnDto } from '../dto/chat-turn.dto';
import { AiDjService } from '../services/ai-dj.service';

@ApiTags('ai-dj')
@ApiBearerAuth()
@Controller('dj')
export class AiDjController {
  constructor(private readonly aiDjService: AiDjService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Submit one AI DJ turn' })
  @ApiResponse({ status: 200, description: 'AI DJ response' })
  async chat(@Body() body: ChatTurnDto) {
    return {
      success: true,
      data: await this.aiDjService.reply({
        sessionId: body.sessionId,
        message: body.message,
      }),
      meta: {},
    };
  }

  @Sse('chat/stream')
  @ApiOperation({ summary: 'Stream AI DJ response over SSE' })
  @ApiQuery({ name: 'sessionId', required: false, type: String })
  @ApiQuery({ name: 'messageId', required: false, type: String })
  stream(
    @Query('sessionId') _sessionId?: string,
    @Query('messageId') _messageId?: string,
  ): Observable<{ data: { event: string; token: string } }> {
    return of({
      data: {
        event: 'done',
        token: 'stub-stream-complete',
      },
    });
  }
}

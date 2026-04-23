import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable, of } from 'rxjs';
import { IsOptional, IsString } from 'class-validator';

class ChatTurnDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  message!: string;

  @IsString()
  responseMode!: string;
}

@ApiTags('ai-dj')
@ApiBearerAuth()
@Controller('dj')
export class AiDjController {
  @Post('chat')
  @ApiOperation({ summary: 'Submit one AI DJ turn' })
  @ApiResponse({ status: 200, description: 'AI DJ response' })
  chat(@Body() body: ChatTurnDto) {
    return {
      success: true,
      data: {
        sessionId: body.sessionId ?? 'chat_stub',
        messageId: 'msg_stub',
        replyText:
          'Here is a first-pass editorial recommendation set, optimized for your current context.',
        actions: [
          {
            type: 'queue_replace',
            payload: {
              contentIds: ['cnt_stub_1', 'cnt_stub_2', 'cnt_stub_3'],
            },
          },
        ],
      },
      meta: {},
    };
  }

  @Sse('chat/stream')
  @ApiOperation({ summary: 'Stream AI DJ response over SSE' })
  @ApiQuery({ name: 'sessionId', required: false, type: String })
  @ApiQuery({ name: 'messageId', required: false, type: String })
  stream(): Observable<{ data: { event: string; token: string } }> {
    return of({
      data: {
        event: 'done',
        token: 'stub-stream-complete',
      },
    });
  }
}

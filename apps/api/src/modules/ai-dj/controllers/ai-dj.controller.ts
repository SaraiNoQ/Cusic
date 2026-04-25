import {
  Body,
  Controller,
  Get,
  Headers,
  MessageEvent,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { RequestWithUser } from '../../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { ChatTurnDto } from '../dto/chat-turn.dto';
import { AiDjService } from '../services/ai-dj.service';

@ApiTags('ai-dj')
@ApiBearerAuth()
@Controller('dj')
export class AiDjController {
  constructor(private readonly aiDjService: AiDjService) {}

  @Post('chat')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Submit one AI DJ turn' })
  @ApiResponse({ status: 200, description: 'AI DJ response' })
  async chat(
    @Body() body: ChatTurnDto,
    @Req() request: RequestWithUser,
    @Headers('x-cusic-timezone') timezoneHeader?: string,
  ) {
    return {
      success: true,
      data: await this.aiDjService.reply({
        ...body,
        user: request.user,
        timezoneHeader,
      }),
      meta: {},
    };
  }

  @Get('sessions/:sessionId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get persisted AI DJ session messages' })
  @ApiResponse({ status: 200, description: 'Session messages' })
  async getSessionMessages(
    @Param('sessionId') sessionId: string,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.aiDjService.getSessionMessages(
        sessionId,
        request.user!.id,
      ),
      meta: {},
    };
  }

  @Sse('chat/stream')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Stream AI DJ response over SSE' })
  @ApiQuery({ name: 'sessionId', required: true, type: String })
  @ApiQuery({ name: 'messageId', required: true, type: String })
  stream(
    @Query('sessionId') sessionId: string,
    @Query('messageId') messageId: string,
    @Req() request: RequestWithUser,
  ): Observable<MessageEvent> {
    return this.aiDjService.streamReply({
      sessionId,
      messageId,
      userId: request.user?.id,
    });
  }
}

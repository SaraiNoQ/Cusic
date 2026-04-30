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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import { SaveAiPlaylistDto } from '../dto/save-ai-playlist.dto';
import { AiDjService } from '../services/ai-dj.service';
import { VoiceService } from '../../voice/voice.service';

@ApiTags('ai-dj')
@ApiBearerAuth()
@Controller('dj')
export class AiDjController {
  constructor(
    private readonly aiDjService: AiDjService,
    private readonly voiceService: VoiceService,
  ) {}

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

  @Post('playlists')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Save an AI DJ theme preview as a playlist' })
  @ApiBody({ type: SaveAiPlaylistDto })
  @ApiResponse({ status: 200, description: 'AI playlist saved' })
  async saveAiPlaylist(
    @Body() body: SaveAiPlaylistDto,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.aiDjService.saveGeneratedPlaylist({
        userId: request.user!.id,
        sessionId: body.sessionId,
        messageId: body.messageId,
        title: body.title,
      }),
      meta: {},
    };
  }

  @Post('voice/chat')
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  @ApiOperation({
    summary: 'Voice AI DJ turn — audio in, text + optional TTS out',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Audio file with voice message',
        },
        sessionId: {
          type: 'string',
          description: 'Optional session ID',
          nullable: true,
        },
        responseMode: {
          type: 'string',
          enum: ['sync', 'stream'],
          description: 'Response mode',
          nullable: true,
        },
        voice: {
          type: 'string',
          description: 'TTS voice (qianxue, aizhen, aishuo)',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Voice AI DJ response' })
  async voiceChat(
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    @Body('sessionId') sessionId?: string,
    @Body('responseMode') responseMode?: string,
    @Body('voice') voice?: string,
    @Req() request?: RequestWithUser,
    @Headers('x-cusic-timezone') timezoneHeader?: string,
  ) {
    // Step 1: ASR — transcribe audio to text
    const format = file?.mimetype || 'audio/webm';
    const transcription = file
      ? await this.voiceService.transcribe(file.buffer, format)
      : { text: '', confidence: 0 };

    // Step 2: Process through AI DJ
    const reply = await this.aiDjService.reply({
      sessionId,
      message: transcription.text,
      responseMode:
        responseMode === 'stream' ? 'stream' : ('sync' as 'sync' | 'stream'),
      user: request?.user,
      timezoneHeader,
    });

    // Step 3: Optional TTS for the reply text
    let audioUrl: string | undefined;
    if (reply.replyText) {
      const synthesis = await this.voiceService.synthesize(
        reply.replyText,
        voice ?? 'qianxue',
      );
      audioUrl = synthesis.audioUrl || undefined;
    }

    return {
      success: true,
      data: {
        reply,
        transcription: transcription.text,
        audioUrl,
      },
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

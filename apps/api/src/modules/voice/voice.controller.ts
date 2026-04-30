import {
  Body,
  Controller,
  Get,
  Post,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { VoiceService } from './voice.service';

class TtsDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  voice?: string;
}

@ApiTags('voice')
@ApiBearerAuth()
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Get('voices')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List available TTS voices' })
  @ApiResponse({ status: 200, description: 'List of available voices' })
  async getVoices() {
    const voices = this.voiceService.getAvailableVoices();
    return {
      success: true,
      data: {
        provider: this.voiceService.getProviderType(),
        voices,
      },
      meta: {},
    };
  }

  @Post('asr')
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  @ApiOperation({ summary: 'Speech-to-text transcription' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Audio file to transcribe',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'ASR transcription result' })
  async asr(
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    if (!file) {
      return {
        success: true,
        data: {
          text: '',
          confidence: 0,
        },
        meta: {},
      };
    }

    // Derive format from the file's declared MIME type
    const format = file.mimetype || 'audio/webm';
    const result = await this.voiceService.transcribe(file.buffer, format);

    return {
      success: true,
      data: result,
      meta: {},
    };
  }

  @Post('tts')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Text-to-speech synthesis' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to synthesize' },
        voice: {
          type: 'string',
          description: 'Voice to use (qianxue, aizhen, aishuo)',
          nullable: true,
        },
      },
      required: ['text'],
    },
  })
  @ApiResponse({ status: 200, description: 'TTS synthesis result' })
  async tts(@Body() body: TtsDto) {
    const result = await this.voiceService.synthesize(
      body.text,
      body.voice ?? 'qianxue',
    );

    return {
      success: true,
      data: result,
      meta: {},
    };
  }
}

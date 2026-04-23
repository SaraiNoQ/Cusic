import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString } from 'class-validator';

class TtsDto {
  @IsString()
  text!: string;

  @IsString()
  voice!: string;
}

@ApiTags('voice')
@ApiBearerAuth()
@Controller('dj/voice')
export class VoiceController {
  @Post('asr')
  @UseInterceptors(FileInterceptor('audio'))
  @ApiOperation({ summary: 'Speech-to-text for AI DJ voice input' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'ASR result' })
  asr(@UploadedFile() file?: unknown) {
    return {
      success: true,
      data: {
        text: file ? 'stub transcription from uploaded audio' : 'no audio uploaded',
      },
      meta: {},
    };
  }

  @Post('tts')
  @ApiOperation({ summary: 'Text-to-speech for AI DJ output' })
  @ApiResponse({ status: 200, description: 'TTS result' })
  tts(@Body() body: TtsDto) {
    return {
      success: true,
      data: {
        audioUrl: `https://example.com/tts/${encodeURIComponent(body.voice)}.mp3`,
        text: body.text,
      },
      meta: {},
    };
  }
}

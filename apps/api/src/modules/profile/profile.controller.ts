import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

class TagUpdateDto {
  @IsString()
  type!: string;

  @IsString()
  value!: string;

  @IsString()
  action!: string;
}

class UpdateTagsDto {
  @IsArray()
  updates!: TagUpdateDto[];
}

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  @Get('taste-report')
  @ApiOperation({ summary: 'Get user taste profile report' })
  @ApiResponse({ status: 200, description: 'Taste report' })
  getTasteReport() {
    return {
      success: true,
      data: {
        summary: 'You currently prefer editorial cantopop, intimate vocals, and late-night focus sessions.',
        explorationLevel: 'medium',
        tags: [
          {
            type: 'genre',
            value: 'cantopop',
            weight: 0.94,
            isNegative: false,
          },
        ],
      },
      meta: {},
    };
  }

  @Patch('tags')
  @ApiOperation({ summary: 'Patch taste profile tags' })
  @ApiResponse({ status: 200, description: 'Tags updated' })
  patchTags(@Body() body: UpdateTagsDto) {
    return {
      success: true,
      data: {
        updated: body.updates.length,
      },
      meta: {},
    };
  }
}


import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

class CreateImportJobDto {
  @IsString()
  providerName!: string;

  @IsString()
  importType!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  @Post('playlists')
  @ApiOperation({ summary: 'Create playlist or history import job' })
  @ApiResponse({ status: 200, description: 'Import job created' })
  createImportJob(@Body() body: CreateImportJobDto) {
    return {
      success: true,
      data: {
        jobId: 'job_stub',
        status: 'queued',
        providerName: body.providerName,
      },
      meta: {},
    };
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get import job status' })
  @ApiParam({ name: 'jobId', type: String })
  @ApiResponse({ status: 200, description: 'Import job status' })
  getImportJob(@Param('jobId') jobId: string) {
    return {
      success: true,
      data: {
        jobId,
        status: 'queued',
      },
      meta: {},
    };
  }
}


import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestWithUser } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateImportJobDto } from './dto/create-import-job.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  @ApiOperation({ summary: 'List import jobs' })
  @ApiResponse({ status: 200, description: 'Import job list' })
  async listImportJobs(@Req() request: RequestWithUser) {
    const items = await this.importsService.listImportJobs(request.user!.id);

    return {
      success: true,
      data: {
        items,
      },
      meta: {
        total: items.length,
      },
    };
  }

  @Post('playlists')
  @ApiOperation({ summary: 'Create playlist or history import job' })
  @ApiBody({ type: CreateImportJobDto })
  @ApiResponse({ status: 200, description: 'Import job created' })
  async createImportJob(
    @Body() body: CreateImportJobDto,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.importsService.createImportJob({
        userId: request.user!.id,
        providerName: body.providerName,
        importType: body.importType,
        payload: body.payload,
      }),
      meta: {},
    };
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Get import job status' })
  @ApiParam({ name: 'jobId', type: String })
  @ApiResponse({ status: 200, description: 'Import job status' })
  async getImportJob(
    @Param('jobId') jobId: string,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.importsService.getImportJob(jobId, request.user!.id),
      meta: {},
    };
  }
}

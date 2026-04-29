import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../auth/guards/jwt-auth.guard';
import {
  KnowledgeQueryRequestDto,
  KnowledgeQueryResponseDto,
} from './dto/knowledge-query.dto';
import { KnowledgeService } from './knowledge.service';

@ApiTags('Knowledge')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('query')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '查询音乐知识' })
  @ApiResponse({
    status: 200,
    description: '知识查询结果',
    type: KnowledgeQueryResponseDto,
  })
  async query(
    @Body() body: KnowledgeQueryRequestDto,
    @Req() request: RequestWithUser,
  ) {
    const result = await this.knowledgeService.query(
      request.user!.id,
      body.chatSessionId ?? null,
      body.question,
    );

    return {
      success: true,
      data: result,
      meta: {},
    };
  }

  @Get('traces')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取知识查询历史' })
  @ApiResponse({ status: 200, description: '知识追踪记录列表' })
  async getTraces(@Req() request: RequestWithUser) {
    const traces = await this.knowledgeService.getTraces(request.user!.id);

    return {
      success: true,
      data: traces,
      meta: {},
    };
  }

  @Get('traces/:traceId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取单条知识查询详情' })
  @ApiResponse({
    status: 200,
    description: '知识追踪记录详情',
    type: KnowledgeQueryResponseDto,
  })
  async getTrace(@Param('traceId') traceId: string) {
    const trace = await this.knowledgeService.getTrace(traceId);

    if (!trace) {
      throw new NotFoundException('Knowledge trace was not found');
    }

    return {
      success: true,
      data: trace,
      meta: {},
    };
  }
}

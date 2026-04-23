import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

class SearchQueryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number;
}

@ApiTags('content')
@ApiBearerAuth()
@Controller()
export class ContentController {
  @Get('search')
  @ApiOperation({ summary: 'Unified search across music, podcasts, and radio' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(@Query() query: SearchQueryDto) {
    return {
      success: true,
      data: {
        items: [
          {
            id: 'cnt_stub_1',
            type: query.type ?? 'track',
            title: query.q ?? 'Stub Search Result',
            artists: ['Stub Artist'],
            album: 'Stub Album',
            durationMs: 210000,
            language: query.language ?? 'zh',
            coverUrl: null,
            playable: true,
          },
        ],
      },
      meta: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total: 1,
        hasMore: false,
      },
    };
  }

  @Get('content/:id')
  @ApiOperation({ summary: 'Get content detail by unified content id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Content detail' })
  getContent(@Param('id') id: string) {
    return {
      success: true,
      data: {
        id,
        type: 'track',
        title: 'Stub Content',
        artists: ['Stub Artist'],
        album: 'Stub Album',
        durationMs: 210000,
        language: 'zh',
        coverUrl: null,
        playable: true,
        providers: ['stub-provider'],
      },
      meta: {},
    };
  }

  @Get('content/:id/related')
  @ApiOperation({ summary: 'Get related content recommendations' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Related content list' })
  getRelated(@Param('id') id: string) {
    return {
      success: true,
      data: {
        sourceContentId: id,
        items: [
          {
            id: 'cnt_related_1',
            type: 'track',
            title: 'Related Stub Track',
            artists: ['Related Artist'],
          },
        ],
      },
      meta: {},
    };
  }
}


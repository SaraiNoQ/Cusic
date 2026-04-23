import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SearchContentDto } from '../dto/search-content.dto';
import { ContentService } from '../services/content.service';

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('search')
  @ApiOperation({ summary: 'Unified search across music, podcasts, and radio' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(@Query() query: SearchContentDto) {
    const result = this.contentService.search(query);

    return {
      success: true,
      data: {
        items: result.items,
      },
      meta: result.meta,
    };
  }

  @Get('content/:id')
  @ApiOperation({ summary: 'Get content detail by unified content id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Content detail' })
  getContent(@Param('id') id: string) {
    const item = this.contentService.getById(id);

    return {
      success: true,
      data: item ?? {
        id,
        type: 'track',
        title: 'Unknown Content',
        artists: ['Unavailable'],
        album: null,
        durationMs: null,
        language: null,
        coverUrl: null,
        audioUrl: null,
        playable: false,
      },
      meta: {},
    };
  }

  @Get('content/:id/related')
  @ApiOperation({ summary: 'Get related content recommendations' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Related content list' })
  getRelated(@Param('id') id: string) {
    const items = this.contentService.getRelated(id);

    return {
      success: true,
      data: {
        sourceContentId: id,
        items,
      },
      meta: {},
    };
  }
}

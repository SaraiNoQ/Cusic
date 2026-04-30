import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KnowledgeQueryRequestDto {
  @ApiProperty({
    description: '用户提问内容',
    example: '周杰伦的第一张专辑是什么？',
  })
  question!: string;

  @ApiPropertyOptional({ description: '关联的聊天会话 ID', example: 'clx...' })
  chatSessionId?: string;
}

export class KnowledgeSourceDto {
  @ApiProperty({ description: '来源 ID' })
  sourceId!: string;

  @ApiProperty({ description: '来源标题' })
  title!: string;

  @ApiProperty({ description: '来源片段' })
  snippet!: string;

  @ApiPropertyOptional({ description: '来源链接' })
  url?: string;

  @ApiProperty({ description: '来源类型：catalog=曲库, web_search=网络搜索' })
  sourceType!: 'catalog' | 'web_search';
}

export class RelatedContentDto {
  @ApiProperty({ description: '内容 ID' })
  contentId!: string;

  @ApiProperty({ description: '内容标题' })
  title!: string;

  @ApiProperty({ description: '艺人名' })
  artist!: string;

  @ApiProperty({ description: '内容类型', example: 'track' })
  type!: string;
}

export class KnowledgeQueryResponseDto {
  @ApiProperty({ description: '知识追踪记录 ID' })
  traceId!: string;

  @ApiProperty({ description: 'LLM 总结文本' })
  summaryText!: string;

  @ApiProperty({ description: '知识来源列表', type: [KnowledgeSourceDto] })
  sources!: KnowledgeSourceDto[];

  @ApiProperty({ description: '关联内容列表', type: [RelatedContentDto] })
  relatedContent!: RelatedContentDto[];
}

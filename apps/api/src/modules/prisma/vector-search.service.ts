import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

interface VectorSearchFilters {
  contentType?: string;
  language?: string;
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search for content items similar to the given embedding vector.
   * Uses pgvector cosine distance (<=>).
   */
  async searchSimilarContent(
    embedding: number[],
    limit: number,
    filters?: VectorSearchFilters,
  ): Promise<Array<Record<string, unknown>>> {
    const vectorStr = `[${embedding.join(',')}]`;

    let query: string;
    const params: unknown[] = [];

    if (filters?.contentType && filters?.language) {
      query = `
        SELECT *, 1 - (embedding <=> $1::vector) AS similarity
        FROM content_items
        WHERE embedding IS NOT NULL
          AND content_type = $2
          AND language = $3
        ORDER BY embedding <=> $1::vector
        LIMIT $4
      `;
      params.push(vectorStr, filters.contentType, filters.language, limit);
    } else if (filters?.contentType) {
      query = `
        SELECT *, 1 - (embedding <=> $1::vector) AS similarity
        FROM content_items
        WHERE embedding IS NOT NULL
          AND content_type = $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;
      params.push(vectorStr, filters.contentType, limit);
    } else if (filters?.language) {
      query = `
        SELECT *, 1 - (embedding <=> $1::vector) AS similarity
        FROM content_items
        WHERE embedding IS NOT NULL
          AND language = $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;
      params.push(vectorStr, filters.language, limit);
    } else {
      query = `
        SELECT *, 1 - (embedding <=> $1::vector) AS similarity
        FROM content_items
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `;
      params.push(vectorStr, limit);
    }

    const results = await this.prisma.$queryRawUnsafe(query, ...params);
    return results as Array<Record<string, unknown>>;
  }

  /**
   * Search for knowledge sources similar to the given embedding vector.
   * Uses pgvector cosine distance (<=>).
   */
  async searchSimilarKnowledge(
    embedding: number[],
    limit: number,
  ): Promise<Array<Record<string, unknown>>> {
    const vectorStr = `[${embedding.join(',')}]`;

    const results = await this.prisma.$queryRaw`
      SELECT *, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM knowledge_sources
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    return results as Array<Record<string, unknown>>;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../llm/services/llm.service';
import { getRequestId } from '../../../common/request-id';

interface EmbeddingInput {
  canonicalTitle: string;
  artists: string[];
  tags?: string[];
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * Generate a semantic embedding for a single content item.
   * Builds a text representation from title, artists, and optional tags,
   * then calls the LLM embedding endpoint.
   */
  async generateContentEmbedding(item: EmbeddingInput): Promise<number[]> {
    const parts: string[] = [];
    parts.push(`Title: ${item.canonicalTitle}`);
    if (item.artists.length > 0) {
      parts.push(`Artists: ${item.artists.join(', ')}`);
    }
    if (item.tags && item.tags.length > 0) {
      parts.push(`Tags: ${item.tags.join(', ')}`);
    }
    const text = parts.join('; ');

    try {
      const results = await this.llmService.embed([text]);
      return results[0];
    } catch (error) {
      this.logger.error(
        `[${getRequestId()}] Failed to generate embedding for "${item.canonicalTitle}": ${String(error)}`,
      );
      throw new Error(
        `Embedding generation failed for "${item.canonicalTitle}"`,
      );
    }
  }

  /**
   * Fetch all playable content items that do not yet have an embedding,
   * generate embeddings in batches of 20, and persist them via raw SQL.
   */
  async generateForAll(): Promise<void> {
    const rows: Array<{
      id: string;
      canonical_title: string;
      primary_artist_names: string[];
      metadata_json: Record<string, unknown> | null;
    }> = await this.prisma.$queryRaw`
      SELECT id, canonical_title, primary_artist_names, metadata_json
      FROM content_items
      WHERE embedding IS NULL AND playable = true
    `;

    if (rows.length === 0) {
      this.logger.log('No content items need embeddings');
      return;
    }

    this.logger.log(
      `[${getRequestId()}] Generating embeddings for ${rows.length} content items`,
    );

    const batchSize = 20;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const texts: string[] = batch.map((row) => {
        const parts: string[] = [];
        parts.push(`Title: ${row.canonical_title}`);
        if (
          row.primary_artist_names &&
          Array.isArray(row.primary_artist_names) &&
          row.primary_artist_names.length > 0
        ) {
          parts.push(`Artists: ${row.primary_artist_names.join(', ')}`);
        }
        // Extract tags from metadata_json if available
        if (row.metadata_json) {
          const meta = row.metadata_json as Record<string, unknown>;
          const tagFields = ['genres', 'styles', 'moods', 'tags'];
          const tags: string[] = [];
          for (const field of tagFields) {
            const val = meta[field];
            if (Array.isArray(val)) {
              tags.push(
                ...(val as string[]).filter((t) => typeof t === 'string'),
              );
            }
          }
          if (tags.length > 0) {
            parts.push(`Tags: ${tags.join(', ')}`);
          }
        }
        return parts.join('; ');
      });

      try {
        const embeddings = await this.llmService.embed(texts);

        for (let j = 0; j < batch.length; j++) {
          const vectorStr = `[${embeddings[j].join(',')}]`;
          await this.prisma.$executeRaw`
            UPDATE content_items SET embedding = ${vectorStr}::vector WHERE id = ${batch[j].id}
          `;
        }

        this.logger.log(
          `Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} complete`,
        );
      } catch (error) {
        failedCount += batch.length;
        this.logger.warn(
          `[${getRequestId()}] Embedding batch ${Math.floor(i / batchSize) + 1} failed: ${String(error)}`,
        );
      }
    }

    if (failedCount > 0) {
      this.logger.warn(
        `[${getRequestId()}] Embedding generation complete with ${failedCount}/${rows.length} items failed`,
      );
    } else {
      this.logger.log('All content embeddings generated');
    }
  }

  /**
   * Nudge a profile embedding toward or away from a content embedding.
   * Returns the adjusted embedding vector.
   */
  async nudgeProfileEmbedding(
    profileEmb: number[],
    contentEmb: number[],
    direction: 'toward' | 'away',
    factor: number = 0.05,
  ): Promise<number[]> {
    if (profileEmb.length !== contentEmb.length) {
      throw new Error(
        `Embedding dimension mismatch: profile=${profileEmb.length} vs content=${contentEmb.length}`,
      );
    }

    const sign = direction === 'toward' ? 1 : -1;
    return profileEmb.map((val, idx) => val + sign * factor * contentEmb[idx]);
  }
}

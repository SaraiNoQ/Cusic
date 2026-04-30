import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { LlmService } from '../llm/services/llm.service';
import { VoiceService } from '../voice/voice.service';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestId } from '../../common/request-id';

@ApiTags('system')
@Controller('system')
export class SystemController {
  private readonly logger = new Logger(SystemController.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly voiceService: VoiceService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'API health check' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  async getHealth() {
    const providerStatus = await this.checkProviders();

    return {
      success: true,
      data: {
        status: 'ok',
        service: 'api',
        version: process.env.APP_VERSION ?? '0.1.0',
        providers: providerStatus,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async checkProviders(): Promise<{
    llm: string;
    voice: string;
    db: string;
    redis: string;
  }> {
    // Run all checks in parallel so no single slow provider blocks the response.
    // Each check gets its own timeout to guarantee the health endpoint returns
    // within the Docker HEALTHCHECK window (< 5s).
    const race = <T>(fn: () => Promise<T>, ms: number, fallback: T) =>
      Promise.race([
        fn(),
        new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
      ]);

    const [llm, db, redis] = await Promise.all([
      race(
        async () => {
          try {
            return (await this.llmService.isAvailable()) ? 'ok' : 'degraded';
          } catch {
            return 'degraded';
          }
        },
        2000,
        'timeout',
      ),
      race(
        async () => {
          try {
            await this.prisma.$queryRaw`SELECT 1`;
            return 'ok';
          } catch {
            return 'error';
          }
        },
        1500,
        'timeout',
      ),
      race(
        async () => {
          let redis: Redis | null = null;
          try {
            redis = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379', {
              connectTimeout: 2000,
              maxRetriesPerRequest: 1,
              lazyConnect: true,
            });
            await redis.connect();
            const pong = await redis.ping();
            return pong === 'PONG' ? 'ok' : 'degraded';
          } catch {
            return 'unavailable';
          } finally {
            redis?.disconnect();
          }
        },
        3000,
        'timeout',
      ),
    ]);

    const voice = this.voiceService.getProviderType();

    return { llm, voice, db, redis };
  }
}

import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
        version: '0.1.0',
        providers: providerStatus,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async checkProviders(): Promise<{
    llm: 'ok' | 'degraded';
    voice: string;
    db: 'ok' | 'error';
  }> {
    // Check LLM
    let llmStatus: 'ok' | 'degraded' = 'degraded';
    try {
      const llmAvailable = await this.llmService.isAvailable();
      llmStatus = llmAvailable ? 'ok' : 'degraded';
    } catch (error) {
      this.logger.warn(
        `[${getRequestId()}] LLM health check failed: ${String(error)}`,
      );
      llmStatus = 'degraded';
    }

    // Check voice provider type
    const voiceStatus = this.voiceService.getProviderType();

    // Check DB
    let dbStatus: 'ok' | 'error' = 'error';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'ok';
    } catch (error) {
      this.logger.error(
        `[${getRequestId()}] DB health check failed: ${String(error)}`,
      );
      dbStatus = 'error';
    }

    return {
      llm: llmStatus,
      voice: voiceStatus,
      db: dbStatus,
    };
  }
}

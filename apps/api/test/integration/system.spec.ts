import { SystemController } from '../../src/modules/system/system.controller';
import type { ContentService } from '../../src/modules/content/services/content.service';
import type { LlmService } from '../../src/modules/llm/services/llm.service';
import type { PrismaService } from '../../src/modules/prisma/prisma.service';
import type { VoiceService } from '../../src/modules/voice/voice.service';

describe('SystemController (integration)', () => {
  it('reports provider status including content catalog mode', async () => {
    const contentService = {
      jamendoProvider: jest.fn(() => ({
        isConfigured: jest.fn(() => true),
      })),
    };
    const llmService = {
      isAvailable: jest.fn().mockResolvedValue(true),
    };
    const voiceService = {
      getProviderType: jest.fn(() => 'mimo'),
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const controller = new SystemController(
      contentService as unknown as ContentService,
      llmService as unknown as LlmService,
      voiceService as unknown as VoiceService,
      prisma as unknown as PrismaService,
    );

    const result = await controller.getHealth();

    expect(result.success).toBe(true);
    expect(result.data.providers).toEqual({
      content: 'jamendo',
      llm: 'ok',
      voice: 'mimo',
      db: 'ok',
      redis: 'ok',
    });
  });
});

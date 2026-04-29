import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type {
  VoiceProvider,
  TranscriptionResult,
  SynthesisResult,
} from './interfaces/voice-provider.interface';
import { AliyunVoiceProvider } from './providers/aliyun-voice.provider';
import { MiMoVoiceProvider } from './providers/mimo-voice.provider';
import { StubVoiceProvider } from './providers/stub-voice.provider';

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: string;
}

const ALIYUN_VOICES: VoiceInfo[] = [
  { id: 'qianxue', name: 'Qianxue', language: 'zh', gender: 'female' },
  { id: 'aizhen', name: 'Aizhen', language: 'zh/en', gender: 'female' },
  { id: 'aishuo', name: 'Aishuo', language: 'zh', gender: 'male' },
];

const MIMO_VOICES: VoiceInfo[] = [
  { id: 'bingtang', name: '冰糖', language: 'zh', gender: 'female' },
  { id: 'molly', name: '茉莉', language: 'zh', gender: 'female' },
  { id: 'soda', name: '苏打', language: 'zh', gender: 'male' },
  { id: 'baihua', name: '白桦', language: 'zh', gender: 'male' },
  { id: 'mia', name: 'Mia', language: 'en', gender: 'female' },
  { id: 'chloe', name: 'Chloe', language: 'en', gender: 'female' },
  { id: 'milo', name: 'Milo', language: 'en', gender: 'male' },
  { id: 'dean', name: 'Dean', language: 'en', gender: 'male' },
];

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly provider: VoiceProvider;
  private readonly providerType: string;
  private readonly ttsCache = new Map<string, SynthesisResult>();

  constructor(private readonly configService: ConfigService) {
    const provider = configService.get<string>('VOICE_PROVIDER', 'stub');

    if (provider === 'mimo') {
      const apiKey = configService.get<string>('MIMO_API_KEY', '');
      const baseUrl = configService.get<string>(
        'MIMO_BASE_URL',
        'https://api.xiaomimimo.com/v1',
      );

      if (apiKey) {
        this.provider = new MiMoVoiceProvider({ apiKey, baseUrl });
        this.providerType = 'mimo';
        this.logger.log('Voice provider: mimo');
      } else {
        this.logger.warn(
          'Voice provider set to mimo but MIMO_API_KEY is missing, falling back to stub',
        );
        this.provider = new StubVoiceProvider();
        this.providerType = 'stub';
      }
    } else if (provider === 'aliyun') {
      const accessKeyId = configService.get<string>('ALIYUN_ACCESS_KEY_ID', '');
      const accessKeySecret = configService.get<string>(
        'ALIYUN_ACCESS_KEY_SECRET',
        '',
      );
      const asrAppKey = configService.get<string>('ALIYUN_ASR_APP_KEY', '');
      const ttsAppKey = configService.get<string>('ALIYUN_TTS_APP_KEY', '');

      if (accessKeyId && accessKeySecret) {
        this.provider = new AliyunVoiceProvider({
          accessKeyId,
          accessKeySecret,
          asrAppKey,
          ttsAppKey,
        });
        this.providerType = 'aliyun';
        this.logger.log('Voice provider: aliyun');
      } else {
        this.logger.warn(
          'Voice provider set to aliyun but credentials are missing, falling back to stub',
        );
        this.provider = new StubVoiceProvider();
        this.providerType = 'stub';
      }
    } else {
      this.provider = new StubVoiceProvider();
      this.providerType = 'stub';
      this.logger.log('Voice provider: stub');
    }
  }

  getAvailableVoices(): VoiceInfo[] {
    switch (this.providerType) {
      case 'mimo':
        return MIMO_VOICES;
      case 'aliyun':
        return ALIYUN_VOICES;
      default:
        return [];
    }
  }

  getProviderType(): string {
    return this.providerType;
  }

  async transcribe(
    audio: Buffer,
    format: string,
  ): Promise<TranscriptionResult> {
    return this.provider.asr(audio, format);
  }

  async synthesize(text: string, voice: string): Promise<SynthesisResult> {
    const cacheKey = this.computeCacheKey(text, voice);
    const cached = this.ttsCache.get(cacheKey);
    if (cached) {
      this.logger.log(`TTS cache hit for key: ${cacheKey.slice(0, 16)}...`);
      return cached;
    }

    const result = await this.provider.tts(text, voice);
    this.ttsCache.set(cacheKey, result);
    return result;
  }

  private computeCacheKey(text: string, voice: string): string {
    return createHash('sha256').update(`${text}:${voice}`).digest('hex');
  }
}

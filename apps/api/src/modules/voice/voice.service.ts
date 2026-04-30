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
import { getRequestId } from '../../common/request-id';

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
  private readonly asrProvider: VoiceProvider;
  private readonly providerType: string;
  private readonly ttsCache = new Map<string, SynthesisResult>();

  constructor(private readonly configService: ConfigService) {
    const provider = configService.get<string>('VOICE_PROVIDER', 'stub');

    // Aliyun credentials (may be used as primary, fallback, or in composite mode)
    const aliyunAccessKeyId = configService.get<string>(
      'ALIYUN_ACCESS_KEY_ID',
      '',
    );
    const aliyunAccessKeySecret = configService.get<string>(
      'ALIYUN_ACCESS_KEY_SECRET',
      '',
    );
    const aliyunAsrAppKey = configService.get<string>('ALIYUN_ASR_APP_KEY', '');
    const aliyunTtsAppKey = configService.get<string>('ALIYUN_TTS_APP_KEY', '');
    const hasAliyun = Boolean(aliyunAccessKeyId && aliyunAccessKeySecret);

    let aliyunProvider: AliyunVoiceProvider | null = null;
    if (hasAliyun) {
      aliyunProvider = new AliyunVoiceProvider({
        accessKeyId: aliyunAccessKeyId,
        accessKeySecret: aliyunAccessKeySecret,
        asrAppKey: aliyunAsrAppKey,
        ttsAppKey: aliyunTtsAppKey,
      });
    }

    if (provider === 'mimo') {
      const apiKey = configService.get<string>('MIMO_API_KEY', '');
      const baseUrl = configService.get<string>(
        'MIMO_BASE_URL',
        'https://api.xiaomimimo.com/v1',
      );

      if (apiKey) {
        this.provider = new MiMoVoiceProvider({
          apiKey,
          baseUrl,
          // MiMo has no hosted ASR, delegate to Aliyun if configured
          asrFallback: aliyunProvider ?? undefined,
        });
        this.providerType = 'mimo';
        this.logger.log(
          '语音服务: MiMo (TTS) + ' +
            (aliyunProvider ? '阿里云 (ASR 降级)' : '无 ASR'),
        );
      } else {
        this.logger.warn(
          'VOICE_PROVIDER=mimo 但 MIMO_API_KEY 缺失，降级为 stub',
        );
        this.provider = new StubVoiceProvider();
        this.providerType = 'stub';
      }

      // MiMo handles ASR internally (delegating to fallback or returning empty)
      this.asrProvider = this.provider;
    } else if (provider === 'aliyun') {
      if (aliyunProvider) {
        this.provider = aliyunProvider;
        this.asrProvider = aliyunProvider;
        this.providerType = 'aliyun';
        this.logger.log('语音服务: 阿里云 NLS (ASR + TTS)');
      } else {
        this.logger.warn('VOICE_PROVIDER=aliyun 但凭证缺失，降级为 stub');
        this.provider = new StubVoiceProvider();
        this.asrProvider = this.provider;
        this.providerType = 'stub';
      }
    } else if (provider === 'composite') {
      // Composite mode: MiMo TTS + Aliyun ASR
      if (!aliyunProvider) {
        this.logger.warn(
          'VOICE_PROVIDER=composite 但阿里云凭证缺失，降级为 stub',
        );
        this.provider = new StubVoiceProvider();
        this.asrProvider = this.provider;
        this.providerType = 'stub';
      } else {
        const apiKey = configService.get<string>('MIMO_API_KEY', '');
        const baseUrl = configService.get<string>(
          'MIMO_BASE_URL',
          'https://api.xiaomimimo.com/v1',
        );

        if (apiKey) {
          this.provider = new MiMoVoiceProvider({
            apiKey,
            baseUrl,
            asrFallback: aliyunProvider,
          });
          this.asrProvider = aliyunProvider;
          this.providerType = 'composite';
          this.logger.log('语音服务: MiMo TTS + 阿里云 ASR (组合模式)');
        } else {
          this.logger.warn(
            'VOICE_PROVIDER=composite 但 MIMO_API_KEY 缺失，降级为 stub',
          );
          this.provider = new StubVoiceProvider();
          this.asrProvider = this.provider;
          this.providerType = 'stub';
        }
      }
    } else {
      this.provider = new StubVoiceProvider();
      this.asrProvider = this.provider;
      this.providerType = 'stub';
      this.logger.log('语音服务: stub (未配置)');
    }
  }

  getAvailableVoices(): VoiceInfo[] {
    switch (this.providerType) {
      case 'mimo':
      case 'composite':
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
    try {
      return await this.asrProvider.asr(audio, format);
    } catch (error) {
      this.logger.error(
        `[${getRequestId()}] Voice transcription failed (provider: ${this.providerType}): ${String(error)}`,
      );
      throw new Error(`Voice transcription is temporarily unavailable`);
    }
  }

  async synthesize(text: string, voice: string): Promise<SynthesisResult> {
    const cacheKey = this.computeCacheKey(text, voice);
    const cached = this.ttsCache.get(cacheKey);
    if (cached) {
      this.logger.log(`TTS 缓存命中: ${cacheKey.slice(0, 16)}...`);
      return cached;
    }

    try {
      const result = await this.provider.tts(text, voice);
      this.ttsCache.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error(
        `[${getRequestId()}] Voice synthesis failed (provider: ${this.providerType}): ${String(error)}`,
      );
      throw new Error(`Voice synthesis is temporarily unavailable`);
    }
  }

  private computeCacheKey(text: string, voice: string): string {
    return createHash('sha256').update(`${text}:${voice}`).digest('hex');
  }
}

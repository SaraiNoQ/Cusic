import { Logger } from '@nestjs/common';
import type {
  VoiceProvider,
  TranscriptionResult,
  SynthesisResult,
} from '../interfaces/voice-provider.interface';

export interface MiMoVoiceConfig {
  apiKey: string;
  baseUrl: string;
  /** Optional fallback ASR provider (e.g. Aliyun) since MiMo has no hosted ASR */
  asrFallback?: VoiceProvider;
}

const BUILT_IN_VOICES: Record<
  string,
  { id: string; language: string; gender: string }
> = {
  bingtang: { id: '冰糖', language: 'zh', gender: 'female' },
  molly: { id: '茉莉', language: 'zh', gender: 'female' },
  soda: { id: '苏打', language: 'zh', gender: 'male' },
  baihua: { id: '白桦', language: 'zh', gender: 'male' },
  mia: { id: 'Mia', language: 'en', gender: 'female' },
  chloe: { id: 'Chloe', language: 'en', gender: 'female' },
  milo: { id: 'Milo', language: 'en', gender: 'male' },
  dean: { id: 'Dean', language: 'en', gender: 'male' },
};

export const MIMO_BUILT_IN_VOICES = BUILT_IN_VOICES;

/**
 * MiMo平台ASR说明：
 * MiMo-V2.5-ASR 模型已开源（GitHub/HuggingFace），但平台不提供托管的 ASR API。
 * 平台仅提供 TTS 系列模型的API服务（mimo-v2.5-tts等）。
 * 如需语音识别，请自行部署开源模型，或使用 fallback provider（如阿里云NLS）。
 */
export class MiMoVoiceProvider implements VoiceProvider {
  private readonly logger = new Logger(MiMoVoiceProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly asrFallback?: VoiceProvider;

  constructor(config: MiMoVoiceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.xiaomimimo.com/v1';
    this.asrFallback = config.asrFallback;
  }

  async asr(audio: Buffer, format: string): Promise<TranscriptionResult> {
    // MiMo平台不提供托管ASR API，尝试使用fallback provider
    if (this.asrFallback) {
      this.logger.log('MiMo: delegating ASR to fallback provider');
      return this.asrFallback.asr(audio, format);
    }

    this.logger.warn(
      'MiMo ASR 不可用 — MiMo平台仅提供TTS API，无托管ASR服务。' +
        '请配置 ASR_FALLBACK_PROVIDER=aliyun 或自行部署 MiMo-V2.5-ASR 开源模型。',
    );
    return {
      text: '',
      confidence: 0,
    };
  }

  async tts(text: string, voiceKey: string): Promise<SynthesisResult> {
    if (!this.apiKey) {
      this.logger.warn('MiMo API key not configured');
      return { audioUrl: '', durationMs: 0 };
    }

    const voiceInfo = BUILT_IN_VOICES[voiceKey] || BUILT_IN_VOICES['bingtang'];

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          model: 'mimo-v2.5-tts',
          messages: [{ role: 'assistant', content: text }],
          audio: {
            format: 'wav',
            voice: voiceInfo.id,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`MiMo TTS HTTP ${response.status}: ${errorBody}`);
        return { audioUrl: '', durationMs: 0 };
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            audio?: {
              data?: string;
            };
          };
        }>;
      };
      const audioBase64 = data?.choices?.[0]?.message?.audio?.data;

      if (!audioBase64) {
        this.logger.error('MiMo TTS: no audio data in response');
        return { audioUrl: '', durationMs: 0 };
      }

      return {
        audioUrl: `data:audio/wav;base64,${audioBase64}`,
        durationMs: 0,
      };
    } catch (error) {
      this.logger.error(`MiMo TTS exception: ${String(error)}`);
      return { audioUrl: '', durationMs: 0 };
    }
  }

  async voiceDesign(
    text: string,
    voiceDescription: string,
  ): Promise<SynthesisResult> {
    if (!this.apiKey) {
      this.logger.warn('MiMo API key not configured');
      return { audioUrl: '', durationMs: 0 };
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          model: 'mimo-v2.5-tts-voicedesign',
          messages: [
            { role: 'user', content: voiceDescription },
            { role: 'assistant', content: text },
          ],
          audio: {
            format: 'wav',
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `MiMo VoiceDesign HTTP ${response.status}: ${errorBody}`,
        );
        return { audioUrl: '', durationMs: 0 };
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            audio?: {
              data?: string;
            };
          };
        }>;
      };
      const audioBase64 = data?.choices?.[0]?.message?.audio?.data;

      if (!audioBase64) {
        this.logger.error('MiMo VoiceDesign: no audio data in response');
        return { audioUrl: '', durationMs: 0 };
      }

      return {
        audioUrl: `data:audio/wav;base64,${audioBase64}`,
        durationMs: 0,
      };
    } catch (error) {
      this.logger.error(`MiMo VoiceDesign exception: ${String(error)}`);
      return { audioUrl: '', durationMs: 0 };
    }
  }

  async voiceClone(
    text: string,
    referenceAudio: Buffer,
    mimeType: string,
  ): Promise<SynthesisResult> {
    if (!this.apiKey) {
      this.logger.warn('MiMo API key not configured');
      return { audioUrl: '', durationMs: 0 };
    }

    const audioBase64 = referenceAudio.toString('base64');
    const voiceDataUrl = `data:${mimeType};base64,${audioBase64}`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          model: 'mimo-v2.5-tts-voiceclone',
          messages: [{ role: 'assistant', content: text }],
          audio: {
            format: 'wav',
            voice: voiceDataUrl,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `MiMo VoiceClone HTTP ${response.status}: ${errorBody}`,
        );
        return { audioUrl: '', durationMs: 0 };
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            audio?: {
              data?: string;
            };
          };
        }>;
      };
      const resultBase64 = data?.choices?.[0]?.message?.audio?.data;

      if (!resultBase64) {
        this.logger.error('MiMo VoiceClone: no audio data in response');
        return { audioUrl: '', durationMs: 0 };
      }

      return {
        audioUrl: `data:audio/wav;base64,${resultBase64}`,
        durationMs: 0,
      };
    } catch (error) {
      this.logger.error(`MiMo VoiceClone exception: ${String(error)}`);
      return { audioUrl: '', durationMs: 0 };
    }
  }
}

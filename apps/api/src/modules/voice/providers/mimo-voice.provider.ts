import { Logger } from '@nestjs/common';
import type {
  VoiceProvider,
  TranscriptionResult,
  SynthesisResult,
} from '../interfaces/voice-provider.interface';

export interface MiMoVoiceConfig {
  apiKey: string;
  baseUrl: string;
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

export class MiMoVoiceProvider implements VoiceProvider {
  private readonly logger = new Logger(MiMoVoiceProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: MiMoVoiceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.xiaomimimo.com/v1';
  }

  async asr(_audio: Buffer, _format: string): Promise<TranscriptionResult> {
    this.logger.warn('MiMo ASR not available — returning stub');
    return { text: '[MiMo ASR not available]', confidence: 0 };
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

import { Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import type {
  VoiceProvider,
  TranscriptionResult,
  SynthesisResult,
} from '../interfaces/voice-provider.interface';

// https://help.aliyun.com/document_detail/84430.htm
const ALIYUN_NLS_HOST = 'nls-gateway-cn-shanghai.aliyuncs.com';

const SUPPORTED_VOICES: Record<string, string> = {
  qianxue: 'CN Female',
  aizhen: 'CN/EN Bilingual Female',
  aishuo: 'CN Male',
};

export interface AliyunVoiceConfig {
  accessKeyId: string;
  accessKeySecret: string;
  asrAppKey: string;
  ttsAppKey: string;
}

function generateAliyunToken(
  accessKeyId: string,
  accessKeySecret: string,
): string {
  // Simplified token generation for NLS REST API
  // Real implementation would use full HMAC-SHA1 signing
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signatureInput = `${accessKeyId}${timestamp}`;
  const signature = createHmac('sha1', accessKeySecret)
    .update(signatureInput)
    .digest('base64');
  return Buffer.from(
    JSON.stringify({
      accessKeyId,
      timestamp,
      signature,
    }),
  ).toString('base64');
}

export class AliyunVoiceProvider implements VoiceProvider {
  private readonly logger = new Logger(AliyunVoiceProvider.name);
  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;
  private readonly asrAppKey: string;
  private readonly ttsAppKey: string;

  constructor(config: AliyunVoiceConfig) {
    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;
    this.asrAppKey = config.asrAppKey;
    this.ttsAppKey = config.ttsAppKey;
  }

  async asr(audio: Buffer, format: string): Promise<TranscriptionResult> {
    if (!this.accessKeyId || !this.accessKeySecret || !this.asrAppKey) {
      this.logger.warn('Aliyun ASR credentials missing, falling back to stub');
      return {
        text: '[stub: Aliyun ASR not configured]',
        confidence: 0,
      };
    }

    try {
      const token = generateAliyunToken(this.accessKeyId, this.accessKeySecret);
      const response = await fetch(`https://${ALIYUN_NLS_HOST}/stream/v1/asr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-NLS-Token': token,
          'X-NLS-Format': format,
          'X-NLS-AppKey': this.asrAppKey,
        },
        body: new Uint8Array(audio),
      });

      if (!response.ok) {
        this.logger.error(
          `Aliyun ASR HTTP ${response.status}: ${await response.text()}`,
        );
        return {
          text: '[ASR error: service unavailable]',
          confidence: 0,
        };
      }

      const data = (await response.json()) as {
        result?: string;
        confidence?: number;
        status?: number;
        message?: string;
      };

      if (data.status !== 20000000) {
        this.logger.error(
          `Aliyun ASR error: ${data.message ?? 'unknown error'}`,
        );
        return {
          text: '[ASR error: transcription failed]',
          confidence: 0,
        };
      }

      return {
        text: data.result ?? '',
        confidence: data.confidence ?? 0,
      };
    } catch (error) {
      this.logger.error(`Aliyun ASR exception: ${String(error)}`);
      return {
        text: '[ASR error: service unavailable]',
        confidence: 0,
      };
    }
  }

  async tts(text: string, voice: string): Promise<SynthesisResult> {
    if (!this.accessKeyId || !this.accessKeySecret || !this.ttsAppKey) {
      this.logger.warn('Aliyun TTS credentials missing, falling back to stub');
      return {
        audioUrl: '',
        durationMs: 0,
      };
    }

    if (!SUPPORTED_VOICES[voice]) {
      this.logger.warn(
        `Voice '${voice}' not in supported list, falling back to qianxue. Supported: ${Object.keys(SUPPORTED_VOICES).join(', ')}`,
      );
      voice = 'qianxue';
    }

    try {
      const token = generateAliyunToken(this.accessKeyId, this.accessKeySecret);
      const response = await fetch(`https://${ALIYUN_NLS_HOST}/stream/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NLS-Token': token,
          'X-NLS-AppKey': this.ttsAppKey,
        },
        body: JSON.stringify({
          text,
          voice,
          format: 'mp3',
          sample_rate: 16000,
          volume: 50,
          speech_rate: 0,
          pitch_rate: 0,
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `Aliyun TTS HTTP ${response.status}: ${await response.text()}`,
        );
        return {
          audioUrl: '',
          durationMs: 0,
        };
      }

      const contentType = response.headers.get('content-type') ?? '';

      // Aliyun TTS REST API may return JSON with audio content or binary audio
      if (contentType.includes('application/json')) {
        const data = (await response.json()) as {
          status?: number;
          message?: string;
          audio_data?: string; // base64 encoded
        };

        if (data.status !== 20000000) {
          this.logger.error(
            `Aliyun TTS error: ${data.message ?? 'unknown error'}`,
          );
          return {
            audioUrl: '',
            durationMs: 0,
          };
        }

        if (data.audio_data) {
          return {
            audioUrl: `data:audio/mp3;base64,${data.audio_data}`,
            durationMs: 0,
          };
        }
      }

      // Binary audio response
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return {
          audioUrl: `data:audio/mp3;base64,${base64}`,
          durationMs: 0,
        };
      }

      return {
        audioUrl: '',
        durationMs: 0,
      };
    } catch (error) {
      this.logger.error(`Aliyun TTS exception: ${String(error)}`);
      return {
        audioUrl: '',
        durationMs: 0,
      };
    }
  }
}

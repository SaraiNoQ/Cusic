import { Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import type {
  VoiceProvider,
  TranscriptionResult,
  SynthesisResult,
} from '../interfaces/voice-provider.interface';

// Aliyun NLS REST API reference: https://help.aliyun.com/document_detail/84430.htm
const ALIYUN_NLS_HOST = 'nls-gateway-cn-shanghai.aliyuncs.com';
const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour
const TOKEN_REFRESH_MARGIN_SECONDS = 300; // refresh 5 min before expiry

const SUPPORTED_ASR_FORMATS: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  wav: 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'mp4',
  mp3: 'mp3',
  m4a: 'mp4',
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  webm: 'webm',
  'audio/ogg': 'opus',
  'audio/ogg;codecs=opus': 'opus',
  ogg: 'opus',
  opus: 'opus',
  'audio/pcm': 'pcm',
  'audio/l16': 'pcm',
  pcm: 'pcm',
};

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

interface CachedToken {
  token: string;
  expiresAt: number; // unix seconds
}

function normalizeAsrFormat(mimeOrFormat: string): string | null {
  return SUPPORTED_ASR_FORMATS[mimeOrFormat.toLowerCase()] ?? null;
}

/**
 * 生成阿里云NLS REST API的临时访问令牌
 *
 * 令牌格式（base64编码的JSON）：
 * {
 *   "accessKeyId": "xxx",
 *   "exp": <过期时间戳-秒>,
 *   "signature": base64(hmac-sha1(AccessKeySecret, AccessKeyId + exp))
 * }
 */
function generateAliyunToken(
  accessKeyId: string,
  accessKeySecret: string,
): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
  const signatureInput = `${accessKeyId}${exp}`;
  const signature = createHmac('sha1', accessKeySecret)
    .update(signatureInput)
    .digest('base64');
  return Buffer.from(JSON.stringify({ accessKeyId, exp, signature })).toString(
    'base64',
  );
}

/**
 * 阿里云 NLS 状态码映射
 * 参考：https://help.aliyun.com/document_detail/84430.htm
 */
function nlsStatusMessage(status: number): string {
  const map: Record<number, string> = {
    20000000: '识别成功',
    40000001: '请求参数错误（请检查音频格式和AppKey）',
    40000002: '语音时长超限（一句话识别最长60秒）',
    40000003: '音频数据解码失败（请确认音频格式）',
    40000004: 'AppKey无效或未授权',
    40000005: 'Token无效或已过期',
    40000010: '并发超限',
  };
  return map[status] ?? `未知错误 (status=${status})`;
}

export class AliyunVoiceProvider implements VoiceProvider {
  private readonly logger = new Logger(AliyunVoiceProvider.name);
  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;
  private readonly asrAppKey: string;
  private readonly ttsAppKey: string;
  private cachedToken: CachedToken | null = null;

  constructor(config: AliyunVoiceConfig) {
    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;
    this.asrAppKey = config.asrAppKey;
    this.ttsAppKey = config.ttsAppKey;
  }

  /** 获取或刷新 NLS 访问令牌 */
  private getToken(): string {
    const now = Math.floor(Date.now() / 1000);
    if (
      this.cachedToken &&
      this.cachedToken.expiresAt > now + TOKEN_REFRESH_MARGIN_SECONDS
    ) {
      return this.cachedToken.token;
    }

    this.logger.log('刷新阿里云 NLS 令牌...');
    const token = generateAliyunToken(this.accessKeyId, this.accessKeySecret);
    this.cachedToken = {
      token,
      expiresAt: now + TOKEN_EXPIRY_SECONDS,
    };
    return token;
  }

  async asr(audio: Buffer, format: string): Promise<TranscriptionResult> {
    // 1. 检查凭证配置
    if (!this.accessKeyId || !this.accessKeySecret || !this.asrAppKey) {
      this.logger.warn('阿里云 ASR 凭证未配置，返回空结果');
      return { text: '', confidence: 0 };
    }

    // 2. 校验音频格式
    const normalizedFormat = normalizeAsrFormat(format);
    if (!normalizedFormat) {
      this.logger.warn(
        `不支持的音频格式: ${format}，支持的MIME格式: audio/wav, audio/mpeg, audio/webm, audio/mp4, audio/ogg, audio/pcm`,
      );
      return { text: '', confidence: 0 };
    }

    // 3. 校验音频大小（NLS 限制 3MB 或 60秒）
    if (audio.length === 0) {
      return { text: '', confidence: 0 };
    }
    if (audio.length > 3 * 1024 * 1024) {
      this.logger.warn(
        `音频过大 (${(audio.length / 1024 / 1024).toFixed(1)}MB)，超过 3MB 限制`,
      );
      return { text: '', confidence: 0 };
    }

    // 4. 调用 NLS REST API
    try {
      const token = this.getToken();
      const response = await fetch(`https://${ALIYUN_NLS_HOST}/stream/v1/asr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-NLS-Token': token,
          'X-NLS-Format': normalizedFormat,
          'X-NLS-AppKey': this.asrAppKey,
        },
        body: new Uint8Array(audio),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`阿里云 ASR HTTP ${response.status}: ${errorText}`);

        // 401/403 通常是 Token 问题，清除缓存以便下次重新获取
        if (response.status === 401 || response.status === 403) {
          this.cachedToken = null;
        }

        return { text: '', confidence: 0 };
      }

      const data = (await response.json()) as {
        result?: string;
        confidence?: number;
        status?: number;
        message?: string;
      };

      if (!data || data.status !== 20000000) {
        const errorMsg = data?.status
          ? nlsStatusMessage(data.status)
          : '服务返回空响应';
        this.logger.error(
          `阿里云 ASR 识别失败: ${errorMsg}${data?.message ? ` (${data.message})` : ''}`,
        );
        return { text: '', confidence: 0 };
      }

      const text = (data.result ?? '').trim();
      if (text) {
        this.logger.log(`阿里云 ASR 识别成功: "${text}"`);
      }

      return {
        text,
        confidence: data.confidence ?? 1,
      };
    } catch (error) {
      this.logger.error(`阿里云 ASR 网络异常: ${String(error)}`);
      return { text: '', confidence: 0 };
    }
  }

  async tts(text: string, voice: string): Promise<SynthesisResult> {
    if (!this.accessKeyId || !this.accessKeySecret || !this.ttsAppKey) {
      this.logger.warn('阿里云 TTS 凭证未配置');
      return { audioUrl: '', durationMs: 0 };
    }

    if (!SUPPORTED_VOICES[voice]) {
      this.logger.warn(
        `TTS 音色 '${voice}' 不在支持列表中，使用默认 qianxue。` +
          `支持: ${Object.keys(SUPPORTED_VOICES).join(', ')}`,
      );
      voice = 'qianxue';
    }

    try {
      const token = this.getToken();
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
          `阿里云 TTS HTTP ${response.status}: ${await response.text()}`,
        );
        return { audioUrl: '', durationMs: 0 };
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
            `阿里云 TTS 错误: ${data.message ?? 'unknown error'}`,
          );
          return { audioUrl: '', durationMs: 0 };
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

      return { audioUrl: '', durationMs: 0 };
    } catch (error) {
      this.logger.error(`阿里云 TTS 网络异常: ${String(error)}`);
      return { audioUrl: '', durationMs: 0 };
    }
  }
}

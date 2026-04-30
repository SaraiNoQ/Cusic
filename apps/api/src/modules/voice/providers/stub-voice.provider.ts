import { Logger } from '@nestjs/common';
import type {
  VoiceProvider,
  TranscriptionResult,
  SynthesisResult,
} from '../interfaces/voice-provider.interface';

/**
 * Stub语音Provider — 默认降级实现
 * 当未配置任何语音服务时使用，返回空结果而非报错
 */
export class StubVoiceProvider implements VoiceProvider {
  private readonly logger = new Logger(StubVoiceProvider.name);

  async asr(_audio: Buffer, _format: string): Promise<TranscriptionResult> {
    this.logger.warn('ASR 未配置 — 语音识别服务不可用');
    return { text: '', confidence: 0 };
  }

  async tts(_text: string, _voice: string): Promise<SynthesisResult> {
    this.logger.warn('TTS 未配置 — 语音合成服务不可用');
    return { audioUrl: '', durationMs: 0 };
  }
}

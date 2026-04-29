import type {
  VoiceProvider,
  TranscriptionResult,
  SynthesisResult,
} from '../interfaces/voice-provider.interface';

export class StubVoiceProvider implements VoiceProvider {
  async asr(_audio: Buffer, _format: string): Promise<TranscriptionResult> {
    return {
      text: '[stub: voice recognition not configured]',
      confidence: 0,
    };
  }

  async tts(_text: string, _voice: string): Promise<SynthesisResult> {
    return {
      audioUrl: '',
      durationMs: 0,
    };
  }
}

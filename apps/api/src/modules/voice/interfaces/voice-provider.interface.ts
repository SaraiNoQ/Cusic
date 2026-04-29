export interface TranscriptionResult {
  text: string;
  confidence: number;
}

export interface SynthesisResult {
  audioUrl: string;
  durationMs: number;
}

export interface VoiceProvider {
  asr(audio: Buffer, format: string): Promise<TranscriptionResult>;
  tts(text: string, voice: string): Promise<SynthesisResult>;
}

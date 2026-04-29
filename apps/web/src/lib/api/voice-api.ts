import { apiFetch } from './client';

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: string;
}

export async function transcribeAudio(audioBlob: Blob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  return apiFetch('/voice/asr', {
    method: 'POST',
    body: formData,
    headers: {}, // let browser set Content-Type for multipart
  });
}

export async function synthesizeSpeech(text: string, voice?: string) {
  return apiFetch('/voice/tts', {
    method: 'POST',
    body: JSON.stringify({ text, voice }),
  });
}

export async function getAvailableVoices(): Promise<{
  success: boolean;
  data: {
    provider: string;
    voices: VoiceInfo[];
  };
}> {
  return apiFetch('/voice/voices', { method: 'GET' });
}

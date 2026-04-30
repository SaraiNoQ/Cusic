import { apiFetch } from './client';

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: string;
}

/**
 * Get a safe file extension from a MIME type for audio uploads.
 */
function mimeToExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return 'ogg';
  if (mimeType.includes('wav') || mimeType.includes('wave')) return 'wav';
  return 'webm'; // default
}

export async function transcribeAudio(audioBlob: Blob) {
  const ext = mimeToExtension(audioBlob.type || 'audio/webm');
  const formData = new FormData();
  formData.append('audio', audioBlob, `recording.${ext}`);
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

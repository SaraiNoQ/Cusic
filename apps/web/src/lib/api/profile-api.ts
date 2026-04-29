import type {
  ApiSuccessEnvelope,
  TasteProfileDto,
  TasteProfileUpdateResponseDto,
  TasteTagUpdateDto,
} from '@music-ai/shared';
import { apiFetch } from './client';

export async function fetchTasteReport() {
  const response = await apiFetch<ApiSuccessEnvelope<TasteProfileDto>>(
    '/profile/taste-report',
  );
  return response.data;
}

export async function updateProfileTags(updates: TasteTagUpdateDto[]) {
  const response = await apiFetch<
    ApiSuccessEnvelope<TasteProfileUpdateResponseDto>
  >('/profile/tags', {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  });
  return response.data;
}

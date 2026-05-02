import type { ApiSuccessEnvelope, SystemHealthDto } from '@music-ai/shared';
import { apiFetch } from './client';

export async function fetchSystemHealth() {
  return apiFetch<ApiSuccessEnvelope<SystemHealthDto>>('/system/health', {
    method: 'GET',
  });
}

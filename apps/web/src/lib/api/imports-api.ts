import type {
  ApiSuccessEnvelope,
  CreateImportJobRequestDto,
  ImportJobDto,
} from '@music-ai/shared';
import { apiFetch } from './client';

export async function listImportJobs() {
  return apiFetch<ApiSuccessEnvelope<{ items: ImportJobDto[] }>>('/imports');
}

export async function createImportJob(input: CreateImportJobRequestDto) {
  const response = await apiFetch<ApiSuccessEnvelope<ImportJobDto>>(
    '/imports/playlists',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function fetchImportJob(jobId: string) {
  const response = await apiFetch<ApiSuccessEnvelope<ImportJobDto>>(
    `/imports/${jobId}`,
  );

  return response.data;
}

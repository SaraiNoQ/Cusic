import { apiFetch } from './client';

export async function queryKnowledge(question: string) {
  return apiFetch('/knowledge/query', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export async function fetchKnowledgeTraces() {
  return apiFetch('/knowledge/traces');
}

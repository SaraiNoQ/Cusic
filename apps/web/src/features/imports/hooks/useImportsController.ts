'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { CreateImportJobRequestDto, ImportJobDto } from '@music-ai/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  createImportJob,
  fetchImportJob,
  listImportJobs,
} from '../../../lib/api/imports-api';
import { queryKeys } from '../../../lib/query/query-keys';
import { useAuthStore } from '../../../store/auth-store';
import { useUiStore } from '../../../store/ui-store';

const defaultPayloadByType: Record<'playlist' | 'history', string> = {
  playlist: JSON.stringify(
    {
      playlistId: 123456,
    },
    null,
    2,
  ),
  history: JSON.stringify(
    {
      albumId: 789012,
    },
    null,
    2,
  ),
};

function upsertJob(list: ImportJobDto[], job: ImportJobDto) {
  return [job, ...list.filter((item) => item.jobId !== job.jobId)].slice(0, 20);
}

function isTerminalStatus(status: ImportJobDto['status']) {
  return ['succeeded', 'failed', 'canceled'].includes(status);
}

export function useImportsController() {
  const authUser = useAuthStore((state) => state.user);
  const isImportsOpen = useUiStore((state) => state.isImportsOpen);
  const [providerName, setProviderName] = useState('jamendo');
  const [importType, setImportType] = useState<'playlist' | 'history'>(
    'playlist',
  );
  const [payloadText, setPayloadText] = useState(defaultPayloadByType.playlist);
  const [jobs, setJobs] = useState<ImportJobDto[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: queryKeys.importJobs(authUser?.id),
    queryFn: listImportJobs,
    enabled: isImportsOpen && Boolean(authUser),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateImportJobRequestDto) => createImportJob(input),
  });

  useEffect(() => {
    if (jobsQuery.data?.data.items) {
      setJobs(jobsQuery.data.data.items);
    }
  }, [jobsQuery.data]);

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    let isCancelled = false;

    const refresh = async () => {
      try {
        const next = await fetchImportJob(activeJobId);
        if (isCancelled) {
          return;
        }

        setJobs((current) => upsertJob(current, next));
        if (isTerminalStatus(next.status)) {
          setActiveJobId(null);
        }
      } catch {
        if (!isCancelled) {
          setFormError('Unable to refresh the import job status.');
          setActiveJobId(null);
        }
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId]);

  const submitImport = async () => {
    setFormError(null);

    const trimmedProviderName = providerName.trim();
    if (!trimmedProviderName) {
      setFormError('Provider name is required.');
      return;
    }

    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Payload must be a JSON object.');
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      setFormError('Payload must be a valid JSON object.');
      return;
    }

    try {
      const job = await createMutation.mutateAsync({
        providerName: trimmedProviderName,
        importType,
        payload,
      });

      setJobs((current) => upsertJob(current, job));
      setActiveJobId(job.jobId);
    } catch {
      setFormError('Unable to submit the import job right now.');
    }
  };

  const statusLabel = useMemo(() => {
    if (createMutation.isPending) {
      return 'DISPATCHING';
    }

    if (activeJobId) {
      return 'TRACKING';
    }

    if (jobsQuery.isFetching) {
      return 'SYNCING';
    }

    return 'IDLE';
  }, [activeJobId, createMutation.isPending, jobsQuery.isFetching]);

  const switchImportType = (nextType: 'playlist' | 'history') => {
    setImportType(nextType);
    setPayloadText(defaultPayloadByType[nextType]);
  };

  return {
    isImportsOpen,
    providerName,
    importType,
    payloadText,
    jobs,
    formError,
    isPending: createMutation.isPending,
    isLoadingJobs: jobsQuery.isFetching,
    statusLabel,
    setProviderName,
    setPayloadText,
    setImportType: switchImportType,
    submitImport,
  };
}

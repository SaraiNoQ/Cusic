import { ImportsController } from '../../src/modules/imports/imports.controller';
import type { ImportsService } from '../../src/modules/imports/imports.service';
import type { ImportJobDto, ImportJobResultSummaryDto } from '@music-ai/shared';
import type { RequestWithUser } from '../../src/modules/auth/guards/jwt-auth.guard';

function mockImportJob(overrides: Partial<ImportJobDto> = {}): ImportJobDto {
  return {
    jobId: 'job_test_1',
    status: 'queued',
    providerName: 'cusic_demo',
    jobType: 'playlist_import',
    payload: { playlistId: 'pl_ext_1' },
    resultSummary: {
      mode: 'worker_stub',
      phase: 'accepted',
      accepted: true,
      importType: 'playlist',
      providerName: 'cusic_demo',
      summaryText: 'Queued a playlist import for cusic_demo.',
    } as ImportJobResultSummaryDto,
    errorText: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

describe('ImportsController (integration)', () => {
  let controller: ImportsController;
  let mockService: Record<string, jest.Mock>;

  const authenticatedRequest: RequestWithUser = {
    headers: { authorization: 'Bearer test-token' },
    user: { id: 'user_1', email: 'a@b.com', sessionId: 'ses_1' },
  };

  beforeEach(() => {
    mockService = {
      listImportJobs: jest.fn(),
      createImportJob: jest.fn(),
      getImportJob: jest.fn(),
    };
    controller = new ImportsController(
      mockService as unknown as ImportsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /imports ──────────────────────────────────────────────────
  describe('listImportJobs()', () => {
    it('returns import job list for authenticated user', async () => {
      const jobs = [
        mockImportJob({ jobId: 'job_1' }),
        mockImportJob({ jobId: 'job_2', status: 'succeeded' }),
      ];
      mockService.listImportJobs!.mockResolvedValue(jobs);

      const result = await controller.listImportJobs(authenticatedRequest);

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].jobId).toBe('job_1');
      expect(result.data.items[1].jobId).toBe('job_2');
      expect(result.meta.total).toBe(2);
      expect(mockService.listImportJobs).toHaveBeenCalledWith('user_1');
    });

    it('returns empty list when no import jobs exist', async () => {
      mockService.listImportJobs!.mockResolvedValue([]);

      const result = await controller.listImportJobs(authenticatedRequest);

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ── POST /imports/playlists ───────────────────────────────────────
  describe('createImportJob()', () => {
    it('accepts a playlist import request and returns created job', async () => {
      const newJob = mockImportJob({
        jobId: 'job_new',
        status: 'queued',
        providerName: 'jamendo',
      });
      mockService.createImportJob!.mockResolvedValue(newJob);

      const result = await controller.createImportJob(
        {
          providerName: 'jamendo',
          importType: 'playlist',
          payload: { playlistId: 'pl_ext_42' },
        },
        authenticatedRequest,
      );

      expect(result.success).toBe(true);
      expect(result.data.jobId).toBe('job_new');
      expect(result.data.status).toBe('queued');
      expect(result.data.jobType).toBe('playlist_import');
      expect(result.data.providerName).toBe('jamendo');
    });

    it('forwards import details and userId to the service', async () => {
      mockService.createImportJob!.mockResolvedValue(mockImportJob());

      await controller.createImportJob(
        {
          providerName: 'spotify',
          importType: 'history',
          payload: { sourceUserId: 'ext_user_1', limit: 50 },
        },
        authenticatedRequest,
      );

      expect(mockService.createImportJob).toHaveBeenCalledWith({
        userId: 'user_1',
        providerName: 'spotify',
        importType: 'history',
        payload: { sourceUserId: 'ext_user_1', limit: 50 },
      });
    });
  });

  // ── GET /imports/:jobId ───────────────────────────────────────────
  describe('getImportJob()', () => {
    it('returns a single import job status by id', async () => {
      mockService.getImportJob!.mockResolvedValue(
        mockImportJob({
          jobId: 'job_42',
          status: 'running',
          startedAt: new Date().toISOString(),
        }),
      );

      const result = await controller.getImportJob(
        'job_42',
        authenticatedRequest,
      );

      expect(result.success).toBe(true);
      expect(result.data.jobId).toBe('job_42');
      expect(result.data.status).toBe('running');
      expect(mockService.getImportJob).toHaveBeenCalledWith('job_42', 'user_1');
    });
  });
});

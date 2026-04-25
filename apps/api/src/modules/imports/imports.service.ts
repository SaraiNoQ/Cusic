import { Injectable, NotFoundException } from '@nestjs/common';
import type { ImportJobDto } from '@music-ai/shared';
import { JobStatus, JobType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async createImportJob(input: {
    userId: string;
    providerName: string;
    importType: 'playlist' | 'history';
    payload: Record<string, unknown>;
  }): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.create({
      data: {
        userId: input.userId,
        providerName: input.providerName.trim(),
        jobStatus: JobStatus.QUEUED,
        jobType: this.toPrismaJobType(input.importType),
        inputPayloadJson: input.payload as Prisma.InputJsonValue,
        resultSummaryJson: {
          accepted: true,
          mode: 'baseline_stub',
        } as Prisma.InputJsonValue,
      },
    });

    return this.toImportJobDto(job);
  }

  async getImportJob(jobId: string, userId: string): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.findFirst({
      where: {
        id: jobId,
        userId,
      },
    });

    if (!job) {
      throw new NotFoundException('Import job was not found');
    }

    return this.toImportJobDto(job);
  }

  async listImportJobs(userId: string): Promise<ImportJobDto[]> {
    const jobs = await this.prisma.importJob.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    return jobs.map((job) => this.toImportJobDto(job));
  }

  private toPrismaJobType(input: 'playlist' | 'history') {
    return input === 'history'
      ? JobType.HISTORY_IMPORT
      : JobType.PLAYLIST_IMPORT;
  }

  private toImportJobDto(job: {
    id: string;
    jobStatus: JobStatus;
    providerName: string;
    jobType: JobType;
    inputPayloadJson: Prisma.JsonValue | null;
    resultSummaryJson: Prisma.JsonValue | null;
    errorText: string | null;
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
  }): ImportJobDto {
    return {
      jobId: job.id,
      status: this.fromPrismaJobStatus(job.jobStatus),
      providerName: job.providerName,
      jobType: this.fromPrismaJobType(job.jobType),
      payload: this.readJsonObject(job.inputPayloadJson) ?? {},
      resultSummary: this.readJsonObject(job.resultSummaryJson),
      errorText: job.errorText,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    };
  }

  private fromPrismaJobStatus(status: JobStatus) {
    switch (status) {
      case JobStatus.RUNNING:
        return 'running';
      case JobStatus.SUCCEEDED:
        return 'succeeded';
      case JobStatus.FAILED:
        return 'failed';
      case JobStatus.CANCELED:
        return 'canceled';
      case JobStatus.QUEUED:
      default:
        return 'queued';
    }
  }

  private fromPrismaJobType(type: JobType) {
    return type === JobType.HISTORY_IMPORT
      ? 'history_import'
      : 'playlist_import';
  }

  private readJsonObject(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}

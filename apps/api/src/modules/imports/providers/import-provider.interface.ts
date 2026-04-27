export interface ImportParams {
  jobId: string;
  userId: string;
  importType: 'playlist' | 'history';
  payload: Record<string, unknown>;
}

export interface ImportResult {
  importedItemCount: number;
  playlistCount: number;
  summaryText: string;
  warnings: string[];
}

export interface ImportProvider {
  readonly name: string;

  validatePayload(payload: Record<string, unknown>): {
    valid: boolean;
    error?: string;
  };

  executeImport(params: ImportParams): Promise<ImportResult>;
}

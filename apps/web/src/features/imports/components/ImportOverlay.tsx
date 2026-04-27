import type { ImportJobDto } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';

function formatTimestamp(value: string | null) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function renderSummary(job: ImportJobDto) {
  if (job.errorText) {
    return job.errorText;
  }

  return job.resultSummary?.summaryText ?? 'No execution summary yet.';
}

export function ImportOverlay({
  isOpen,
  providerName,
  importType,
  payloadText,
  jobs,
  formError,
  isPending,
  statusLabel,
  onClose,
  onProviderNameChange,
  onImportTypeChange,
  onPayloadTextChange,
  onSubmit,
}: Readonly<{
  isOpen: boolean;
  providerName: string;
  importType: 'playlist' | 'history';
  payloadText: string;
  jobs: ImportJobDto[];
  formError: string | null;
  isPending: boolean;
  statusLabel: string;
  onClose: () => void;
  onProviderNameChange: (value: string) => void;
  onImportTypeChange: (value: 'playlist' | 'history') => void;
  onPayloadTextChange: (value: string) => void;
  onSubmit: () => void;
}>) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className={styles.overlay}>
      <div className={styles.overlayFog} onClick={onClose} aria-hidden="true" />
      <div className={styles.importOverlayCard}>
        <header className={styles.searchHeader}>
          <div>
            <span className={styles.searchEyebrow}>IMPORT CONSOLE</span>
            <h2>Playlist and history intake</h2>
          </div>
          <button
            type="button"
            className={styles.searchClose}
            onClick={onClose}
          >
            CLOSE
          </button>
        </header>

        <div className={styles.importOverlayBody}>
          <section className={styles.importComposer}>
            <div className={styles.importSectionHeader}>
              <div>
                <span className={styles.searchEyebrow}>NEW JOB</span>
                <h3>Dispatch import task</h3>
              </div>
              <strong>{statusLabel}</strong>
            </div>

            <div className={styles.importFormGrid}>
              <label className={styles.importField}>
                <span>PROVIDER</span>
                <input
                  value={providerName}
                  onChange={(event) => onProviderNameChange(event.target.value)}
                  placeholder="jamendo"
                />
              </label>

              <label className={styles.importField}>
                <span>TYPE</span>
                <div className={styles.importTypeSegment}>
                  <button
                    type="button"
                    className={
                      importType === 'playlist'
                        ? styles.importTypeButtonActive
                        : undefined
                    }
                    onClick={() => onImportTypeChange('playlist')}
                  >
                    PLAYLIST
                  </button>
                  <button
                    type="button"
                    className={
                      importType === 'history'
                        ? styles.importTypeButtonActive
                        : undefined
                    }
                    onClick={() => onImportTypeChange('history')}
                  >
                    HISTORY
                  </button>
                </div>
              </label>
            </div>

            <label className={styles.importPayloadField}>
              <span>PAYLOAD JSON</span>
              <textarea
                value={payloadText}
                onChange={(event) => onPayloadTextChange(event.target.value)}
                spellCheck={false}
              />
            </label>

            <div className={styles.importFormFooter}>
              <p>
                {formError ??
                  (providerName === 'jamendo'
                    ? 'Enter a Jamendo playlist or album ID. Jobs run through BullMQ.'
                    : 'Jobs run through BullMQ and are tracked until they settle.')}
              </p>
              <button
                type="button"
                className={styles.importSubmitButton}
                onClick={onSubmit}
                disabled={isPending}
              >
                {isPending ? 'QUEUING' : 'SUBMIT'}
              </button>
            </div>
          </section>

          <section className={styles.importHistory}>
            <div className={styles.importSectionHeader}>
              <div>
                <span className={styles.searchEyebrow}>RECENT JOBS</span>
                <h3>Execution history</h3>
              </div>
              <strong>{jobs.length.toString().padStart(2, '0')}</strong>
            </div>

            <div className={styles.importJobList}>
              {jobs.length === 0 ? (
                <article className={styles.importJobCard}>
                  <div className={styles.importJobMeta}>
                    <span>NO JOBS YET</span>
                    <strong>READY</strong>
                  </div>
                  <p className={styles.importJobSummary}>
                    Submit a playlist or history import to start building the
                    execution ledger.
                  </p>
                </article>
              ) : (
                jobs.map((job) => (
                  <article key={job.jobId} className={styles.importJobCard}>
                    <div className={styles.importJobMeta}>
                      <span>
                        {job.providerName.toUpperCase()} ·{' '}
                        {job.jobType === 'history_import'
                          ? 'HISTORY'
                          : 'PLAYLIST'}
                      </span>
                      <strong data-status={job.status}>
                        {job.status.toUpperCase()}
                      </strong>
                    </div>
                    <p className={styles.importJobSummary}>
                      {renderSummary(job)}
                    </p>
                    <div className={styles.importJobFooter}>
                      <span>{formatTimestamp(job.createdAt)}</span>
                      <span>
                        {job.resultSummary?.importedItemCount ??
                          job.resultSummary?.playlistCount ??
                          job.resultSummary?.historyItemCount ??
                          0}{' '}
                        ITEMS
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

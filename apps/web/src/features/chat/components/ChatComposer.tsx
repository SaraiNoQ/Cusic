import { useCallback, useRef, type KeyboardEvent } from 'react';
import styles from '../../player/PlayerScreen.module.css';
import { VoiceRecordButton } from './VoiceRecordButton';

export function ChatComposer({
  value,
  isPending,
  onChange,
  onSubmit,
}: Readonly<{
  value: string;
  isPending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (value.trim() && !isPending) {
        void onSubmit();
      }
    }
  };

  const handleVoiceTranscription = useCallback(
    (text: string) => {
      onChange(text);
    },
    [onChange],
  );

  const supportsVoice =
    typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) {
          void onSubmit();
        }
      }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Say something to the DJ..."
      />
      {supportsVoice ? (
        <VoiceRecordButton onTranscription={handleVoiceTranscription} />
      ) : (
        <button
          type="button"
          className={styles.micButton}
          aria-label="Voice input"
        >
          <span />
        </button>
      )}
      <button
        type="submit"
        className={styles.sendButton}
        disabled={isPending}
        aria-label={isPending ? 'AI DJ is thinking...' : 'Send'}
      >
        <span>{isPending ? <i className={styles.spinner} /> : '↑'}</span>
      </button>
    </form>
  );
}

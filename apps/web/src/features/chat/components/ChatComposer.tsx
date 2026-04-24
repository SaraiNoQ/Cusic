import styles from '../../player/PlayerScreen.module.css';

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
  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <textarea
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Say something to the DJ..."
      />
      <button
        type="button"
        className={styles.micButton}
        aria-label="Voice input"
      >
        <span />
      </button>
      <button
        type="submit"
        className={styles.sendButton}
        disabled={isPending}
        aria-label="Send"
      >
        <span>{isPending ? '...' : '↑'}</span>
      </button>
    </form>
  );
}

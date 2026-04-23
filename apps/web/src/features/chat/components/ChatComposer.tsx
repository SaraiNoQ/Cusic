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
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="让 AI DJ 点歌、换风格、讲一段音乐史，或者直接替你重排当前播放队列。"
      />
      <button
        type="submit"
        className={styles.composerButton}
        disabled={isPending}
      >
        {isPending ? 'Sending…' : 'Send to AI DJ'}
      </button>
    </form>
  );
}
